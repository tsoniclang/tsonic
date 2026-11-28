import type { BodyId, BodyPath, CandidateListId, DefId, DefinitionPath, ItemNodeRef, LocalId, LocalRef, LibraryModuleIdentity, ModuleId, NodeId, NodeRef, Origin, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { Diagnostic, ErrorValue, TextParseResult, UnitRef, Violation } from "../diag/contract.js";
import type { ArtifactBindings, BindingScope, BindingVector, LiteralTypeValue, LiteralValue, MemberKey, MemberOrigin, MemberStorageSelection, NominalDefinition, PassingMode, ReferenceArgumentView, Signature, SignatureEndpoint, SignatureParameter, SourceObjectHolding, SourceObjectField, TypeComponent, TypeParameter, TypeTable } from "../ir-types/contract.js";
import type { HirBindingTarget, HirModuleBinding, HirModuleExport, HirBindingViews, HirBindingResolution } from "./binding-data.js";
import type { TypeTerm } from "../ir-types/contract.js";
export type * from "./binding-data.js";
import type { CapturedFact } from "./capture-data.js";
export type { CapturedFact } from "./capture-data.js";

export type IsModuleBindingKind = (kind: string, hasName: boolean) => boolean;
export type IsTypeOnlyExportStar = (node: HirNode | null | undefined) => boolean;
export type ResolveModuleBinding = (views: HirBindingViews, occurrence: SourceNodeRef) => HirBindingResolution;
export type CreateModuleBindingViews = (tables: readonly (readonly HirModuleBinding[])[]) => HirBindingViews;
export type ResolveModuleExport = (views: HirBindingViews, entry: HirModuleExport) => HirBindingResolution;

export interface CheckedTypingCut {
  readonly module: ModuleId;
  readonly node: HirNode;
  readonly report: UnitRef;
  readonly error: ErrorValue;
  readonly diagnostics: readonly [Diagnostic];
}

export interface CheckedTypingCuts {
  readonly syntax: (node: HirNode) => CheckedTypingCut | null;
  readonly body: (body: BodyId) => CheckedTypingCut | null;
  readonly declaration: (definition: DefId) => CheckedTypingCut | null;
  readonly parameterInitializer: (definition: DefId, index: number) => CheckedTypingCut | null;
}

export interface TextRange {
  readonly pos: number;
  readonly end: number;
}

export type SyntaxKind =
  | "Unknown"
  | "EndOfFile"
  | "SingleLineCommentTrivia"
  | "MultiLineCommentTrivia"
  | "NewLineTrivia"
  | "WhitespaceTrivia"
  | "ConflictMarkerTrivia"
  | "NonTextFileMarkerTrivia"
  | "NumericLiteral"
  | "BigIntLiteral"
  | "StringLiteral"
  | "JsxText"
  | "JsxTextAllWhiteSpaces"
  | "RegularExpressionLiteral"
  | "NoSubstitutionTemplateLiteral"
  | "TemplateHead"
  | "TemplateMiddle"
  | "TemplateTail"
  | "OpenBraceToken"
  | "CloseBraceToken"
  | "OpenParenToken"
  | "CloseParenToken"
  | "OpenBracketToken"
  | "CloseBracketToken"
  | "DotToken"
  | "DotDotDotToken"
  | "SemicolonToken"
  | "CommaToken"
  | "QuestionDotToken"
  | "LessThanToken"
  | "LessThanSlashToken"
  | "GreaterThanToken"
  | "LessThanEqualsToken"
  | "GreaterThanEqualsToken"
  | "EqualsEqualsToken"
  | "ExclamationEqualsToken"
  | "EqualsEqualsEqualsToken"
  | "ExclamationEqualsEqualsToken"
  | "EqualsGreaterThanToken"
  | "PlusToken"
  | "MinusToken"
  | "AsteriskToken"
  | "AsteriskAsteriskToken"
  | "SlashToken"
  | "PercentToken"
  | "PlusPlusToken"
  | "MinusMinusToken"
  | "LessThanLessThanToken"
  | "GreaterThanGreaterThanToken"
  | "GreaterThanGreaterThanGreaterThanToken"
  | "AmpersandToken"
  | "BarToken"
  | "CaretToken"
  | "ExclamationToken"
  | "TildeToken"
  | "AmpersandAmpersandToken"
  | "BarBarToken"
  | "QuestionToken"
  | "ColonToken"
  | "AtToken"
  | "QuestionQuestionToken"
  | "BacktickToken"
  | "HashToken"
  | "EqualsToken"
  | "PlusEqualsToken"
  | "MinusEqualsToken"
  | "AsteriskEqualsToken"
  | "AsteriskAsteriskEqualsToken"
  | "SlashEqualsToken"
  | "PercentEqualsToken"
  | "LessThanLessThanEqualsToken"
  | "GreaterThanGreaterThanEqualsToken"
  | "GreaterThanGreaterThanGreaterThanEqualsToken"
  | "AmpersandEqualsToken"
  | "BarEqualsToken"
  | "BarBarEqualsToken"
  | "AmpersandAmpersandEqualsToken"
  | "QuestionQuestionEqualsToken"
  | "CaretEqualsToken"
  | "Identifier"
  | "PrivateIdentifier"
  | "JSDocCommentTextToken"
  | "BreakKeyword"
  | "CaseKeyword"
  | "CatchKeyword"
  | "ClassKeyword"
  | "ConstKeyword"
  | "ContinueKeyword"
  | "DebuggerKeyword"
  | "DefaultKeyword"
  | "DeleteKeyword"
  | "DoKeyword"
  | "ElseKeyword"
  | "EnumKeyword"
  | "ExportKeyword"
  | "ExtendsKeyword"
  | "FalseKeyword"
  | "FinallyKeyword"
  | "ForKeyword"
  | "FunctionKeyword"
  | "IfKeyword"
  | "ImportKeyword"
  | "InKeyword"
  | "InstanceOfKeyword"
  | "NewKeyword"
  | "NullKeyword"
  | "ReturnKeyword"
  | "SuperKeyword"
  | "SwitchKeyword"
  | "ThisKeyword"
  | "ThrowKeyword"
  | "TrueKeyword"
  | "TryKeyword"
  | "TypeOfKeyword"
  | "VarKeyword"
  | "VoidKeyword"
  | "WhileKeyword"
  | "WithKeyword"
  | "ImplementsKeyword"
  | "InterfaceKeyword"
  | "LetKeyword"
  | "PackageKeyword"
  | "PrivateKeyword"
  | "ProtectedKeyword"
  | "PublicKeyword"
  | "StaticKeyword"
  | "YieldKeyword"
  | "AbstractKeyword"
  | "AccessorKeyword"
  | "AsKeyword"
  | "AssertsKeyword"
  | "AssertKeyword"
  | "AnyKeyword"
  | "AsyncKeyword"
  | "AwaitKeyword"
  | "BooleanKeyword"
  | "ConstructorKeyword"
  | "DeclareKeyword"
  | "GetKeyword"
  | "ImmediateKeyword"
  | "InferKeyword"
  | "IntrinsicKeyword"
  | "IsKeyword"
  | "KeyOfKeyword"
  | "ModuleKeyword"
  | "NamespaceKeyword"
  | "NeverKeyword"
  | "OutKeyword"
  | "ReadonlyKeyword"
  | "RequireKeyword"
  | "NumberKeyword"
  | "ObjectKeyword"
  | "SatisfiesKeyword"
  | "SetKeyword"
  | "StringKeyword"
  | "SymbolKeyword"
  | "TypeKeyword"
  | "UndefinedKeyword"
  | "UniqueKeyword"
  | "UnknownKeyword"
  | "UsingKeyword"
  | "FromKeyword"
  | "GlobalKeyword"
  | "BigIntKeyword"
  | "OverrideKeyword"
  | "OfKeyword"
  | "DeferKeyword"
  | "QualifiedName"
  | "ComputedPropertyName"
  | "TypeParameter"
  | "Parameter"
  | "Decorator"
  | "PropertySignature"
  | "PropertyDeclaration"
  | "MethodSignature"
  | "MethodDeclaration"
  | "ClassStaticBlockDeclaration"
  | "Constructor"
  | "GetAccessor"
  | "SetAccessor"
  | "CallSignature"
  | "ConstructSignature"
  | "IndexSignature"
  | "TypePredicate"
  | "TypeReference"
  | "FunctionType"
  | "ConstructorType"
  | "TypeQuery"
  | "TypeLiteral"
  | "ArrayType"
  | "TupleType"
  | "OptionalType"
  | "RestType"
  | "UnionType"
  | "IntersectionType"
  | "ConditionalType"
  | "InferType"
  | "ParenthesizedType"
  | "ThisType"
  | "TypeOperator"
  | "IndexedAccessType"
  | "MappedType"
  | "LiteralType"
  | "NamedTupleMember"
  | "TemplateLiteralType"
  | "TemplateLiteralTypeSpan"
  | "ImportType"
  | "ObjectBindingPattern"
  | "ArrayBindingPattern"
  | "BindingElement"
  | "ArrayLiteralExpression"
  | "ObjectLiteralExpression"
  | "PropertyAccessExpression"
  | "ElementAccessExpression"
  | "CallExpression"
  | "NewExpression"
  | "TaggedTemplateExpression"
  | "TypeAssertionExpression"
  | "ParenthesizedExpression"
  | "FunctionExpression"
  | "ArrowFunction"
  | "DeleteExpression"
  | "TypeOfExpression"
  | "VoidExpression"
  | "AwaitExpression"
  | "PrefixUnaryExpression"
  | "PostfixUnaryExpression"
  | "BinaryExpression"
  | "ConditionalExpression"
  | "TemplateExpression"
  | "YieldExpression"
  | "SpreadElement"
  | "ClassExpression"
  | "OmittedExpression"
  | "ExcludedExpression"
  | "ExpressionWithTypeArguments"
  | "AsExpression"
  | "NonNullExpression"
  | "MetaProperty"
  | "SyntheticExpression"
  | "SatisfiesExpression"
  | "TemplateSpan"
  | "SemicolonClassElement"
  | "Block"
  | "EmptyStatement"
  | "VariableStatement"
  | "ExpressionStatement"
  | "IfStatement"
  | "DoStatement"
  | "WhileStatement"
  | "ForStatement"
  | "ForInStatement"
  | "ForOfStatement"
  | "ContinueStatement"
  | "BreakStatement"
  | "ReturnStatement"
  | "WithStatement"
  | "SwitchStatement"
  | "LabeledStatement"
  | "ThrowStatement"
  | "TryStatement"
  | "DebuggerStatement"
  | "VariableDeclaration"
  | "VariableDeclarationList"
  | "FunctionDeclaration"
  | "ClassDeclaration"
  | "InterfaceDeclaration"
  | "TypeAliasDeclaration"
  | "EnumDeclaration"
  | "ModuleDeclaration"
  | "ModuleBlock"
  | "CaseBlock"
  | "NamespaceExportDeclaration"
  | "ImportEqualsDeclaration"
  | "ImportDeclaration"
  | "ImportClause"
  | "NamespaceImport"
  | "NamedImports"
  | "ImportSpecifier"
  | "ExportAssignment"
  | "ExportDeclaration"
  | "NamedExports"
  | "NamespaceExport"
  | "ExportSpecifier"
  | "MissingDeclaration"
  | "ExternalModuleReference"
  | "JsxElement"
  | "JsxSelfClosingElement"
  | "JsxOpeningElement"
  | "JsxClosingElement"
  | "JsxFragment"
  | "JsxOpeningFragment"
  | "JsxClosingFragment"
  | "JsxAttribute"
  | "JsxAttributes"
  | "JsxSpreadAttribute"
  | "JsxExpression"
  | "JsxNamespacedName"
  | "CaseClause"
  | "DefaultClause"
  | "HeritageClause"
  | "CatchClause"
  | "ImportAttributes"
  | "ImportAttribute"
  | "PropertyAssignment"
  | "ShorthandPropertyAssignment"
  | "SpreadAssignment"
  | "EnumMember"
  | "SourceFile"
  | "JSDocTypeExpression"
  | "JSDocNameReference"
  | "JSDocAllType"
  | "JSDocNullableType"
  | "JSDocNonNullableType"
  | "JSDocOptionalType"
  | "JSDocVariadicType"
  | "JSDoc"
  | "JSDocText"
  | "JSDocTypeLiteral"
  | "JSDocSignature"
  | "JSDocLink"
  | "JSDocLinkCode"
  | "JSDocLinkPlain"
  | "JSDocUnknownTag"
  | "JSDocAugmentsTag"
  | "JSDocImplementsTag"
  | "JSDocDeprecatedTag"
  | "JSDocPublicTag"
  | "JSDocPrivateTag"
  | "JSDocProtectedTag"
  | "JSDocReadonlyTag"
  | "JSDocOverrideTag"
  | "JSDocCallbackTag"
  | "JSDocOverloadTag"
  | "JSDocParameterTag"
  | "JSDocReturnTag"
  | "JSDocThisTag"
  | "JSDocTypeTag"
  | "JSDocTemplateTag"
  | "JSDocTypedefTag"
  | "JSDocSeeTag"
  | "JSDocPropertyTag"
  | "JSDocThrowsTag"
  | "JSDocSatisfiesTag"
  | "JSDocImportTag"
  | "SyntaxList"
  | "JSTypeAliasDeclaration"
  | "JSImportDeclaration"
  | "NotEmittedStatement"
  | "PartiallyEmittedExpression"
  | "SyntheticReferenceExpression"
  | "NotEmittedTypeElement";

export type SyntaxFlag = "Let" | "Const" | "Using" | "OptionalChain" | "DisallowInContext" | "YieldContext" | "DecoratorContext" | "AwaitContext" | "DisallowConditionalTypesContext" | "ThisNodeHasError" | "JavaScriptFile" | "ThisNodeOrAnySubNodesHasError" | "HasJSDoc" | "JSDoc" | "Ambient" | "InWithStatement" | "JsonFile" | "IdentifierHasExtendedUnicodeEscape" | "IdentifierIsInJSDocNamespace" | "NestedNamespace" | "AwaitUsing";

export type TokenFlag = "PrecedingLineBreak" | "PrecedingJSDocComment" | "Unterminated" | "ExtendedUnicodeEscape" | "Scientific" | "Octal" | "HexSpecifier" | "BinarySpecifier" | "OctalSpecifier" | "ContainsSeparator" | "UnicodeEscape" | "ContainsInvalidEscape" | "HexEscape" | "ContainsLeadingZero" | "ContainsInvalidSeparator" | "PrecedingJSDocLeadingAsterisks" | "SingleQuote" | "PrecedingJSDocWithDeprecated" | "PrecedingJSDocWithSeeOrLink";

export type TriviaSyntaxKind = "SingleLineCommentTrivia" | "MultiLineCommentTrivia" | "NewLineTrivia" | "WhitespaceTrivia" | "ConflictMarkerTrivia";

export type LiteralSyntaxKind = "NumericLiteral" | "BigIntLiteral" | "StringLiteral" | "JsxText" | "JsxTextAllWhiteSpaces" | "RegularExpressionLiteral" | "NoSubstitutionTemplateLiteral";

export type PseudoLiteralSyntaxKind = "TemplateHead" | "TemplateMiddle" | "TemplateTail";

export type PunctuationSyntaxKind = "OpenBraceToken" | "CloseBraceToken" | "OpenParenToken" | "CloseParenToken" | "OpenBracketToken" | "CloseBracketToken" | "DotToken" | "DotDotDotToken" | "SemicolonToken" | "CommaToken" | "QuestionDotToken" | "LessThanToken" | "LessThanSlashToken" | "GreaterThanToken" | "LessThanEqualsToken" | "GreaterThanEqualsToken" | "EqualsEqualsToken" | "ExclamationEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "EqualsGreaterThanToken" | "PlusToken" | "MinusToken" | "AsteriskToken" | "AsteriskAsteriskToken" | "SlashToken" | "PercentToken" | "PlusPlusToken" | "MinusMinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "AmpersandToken" | "BarToken" | "CaretToken" | "ExclamationToken" | "TildeToken" | "AmpersandAmpersandToken" | "BarBarToken" | "QuestionToken" | "ColonToken" | "AtToken" | "QuestionQuestionToken" | "BacktickToken" | "HashToken" | "EqualsToken" | "PlusEqualsToken" | "MinusEqualsToken" | "AsteriskEqualsToken" | "AsteriskAsteriskEqualsToken" | "SlashEqualsToken" | "PercentEqualsToken" | "LessThanLessThanEqualsToken" | "GreaterThanGreaterThanEqualsToken" | "GreaterThanGreaterThanGreaterThanEqualsToken" | "AmpersandEqualsToken" | "BarEqualsToken" | "BarBarEqualsToken" | "AmpersandAmpersandEqualsToken" | "QuestionQuestionEqualsToken" | "CaretEqualsToken";

export type KeywordSyntaxKind = "BreakKeyword" | "CaseKeyword" | "CatchKeyword" | "ClassKeyword" | "ConstKeyword" | "ContinueKeyword" | "DebuggerKeyword" | "DefaultKeyword" | "DeleteKeyword" | "DoKeyword" | "ElseKeyword" | "EnumKeyword" | "ExportKeyword" | "ExtendsKeyword" | "FalseKeyword" | "FinallyKeyword" | "ForKeyword" | "FunctionKeyword" | "IfKeyword" | "ImportKeyword" | "InKeyword" | "InstanceOfKeyword" | "NewKeyword" | "NullKeyword" | "ReturnKeyword" | "SuperKeyword" | "SwitchKeyword" | "ThisKeyword" | "ThrowKeyword" | "TrueKeyword" | "TryKeyword" | "TypeOfKeyword" | "VarKeyword" | "VoidKeyword" | "WhileKeyword" | "WithKeyword" | "ImplementsKeyword" | "InterfaceKeyword" | "LetKeyword" | "PackageKeyword" | "PrivateKeyword" | "ProtectedKeyword" | "PublicKeyword" | "StaticKeyword" | "YieldKeyword" | "AbstractKeyword" | "AccessorKeyword" | "AsKeyword" | "AssertsKeyword" | "AssertKeyword" | "AnyKeyword" | "AsyncKeyword" | "AwaitKeyword" | "BooleanKeyword" | "ConstructorKeyword" | "DeclareKeyword" | "GetKeyword" | "ImmediateKeyword" | "InferKeyword" | "IntrinsicKeyword" | "IsKeyword" | "KeyOfKeyword" | "ModuleKeyword" | "NamespaceKeyword" | "NeverKeyword" | "OutKeyword" | "ReadonlyKeyword" | "RequireKeyword" | "NumberKeyword" | "ObjectKeyword" | "SatisfiesKeyword" | "SetKeyword" | "StringKeyword" | "SymbolKeyword" | "TypeKeyword" | "UndefinedKeyword" | "UniqueKeyword" | "UnknownKeyword" | "UsingKeyword" | "FromKeyword" | "GlobalKeyword" | "BigIntKeyword" | "OverrideKeyword" | "OfKeyword" | "DeferKeyword";

export type ModifierSyntaxKind = "AbstractKeyword" | "AccessorKeyword" | "AsyncKeyword" | "ConstKeyword" | "DeclareKeyword" | "DefaultKeyword" | "ExportKeyword" | "InKeyword" | "PrivateKeyword" | "ProtectedKeyword" | "PublicKeyword" | "ReadonlyKeyword" | "OutKeyword" | "OverrideKeyword" | "StaticKeyword";

export type KeywordTypeSyntaxKind = "AnyKeyword" | "BigIntKeyword" | "BooleanKeyword" | "IntrinsicKeyword" | "NeverKeyword" | "NumberKeyword" | "ObjectKeyword" | "StringKeyword" | "SymbolKeyword" | "UndefinedKeyword" | "UnknownKeyword" | "VoidKeyword";

export type KeywordExpressionSyntaxKind = "NullKeyword" | "TrueKeyword" | "FalseKeyword" | "ThisKeyword" | "SuperKeyword" | "ImportKeyword";

export type TokenSyntaxKind = "Unknown" | "EndOfFile" | "SingleLineCommentTrivia" | "MultiLineCommentTrivia" | "NewLineTrivia" | "WhitespaceTrivia" | "ConflictMarkerTrivia" | "NonTextFileMarkerTrivia" | "NumericLiteral" | "BigIntLiteral" | "StringLiteral" | "JsxText" | "JsxTextAllWhiteSpaces" | "RegularExpressionLiteral" | "NoSubstitutionTemplateLiteral" | "TemplateHead" | "TemplateMiddle" | "TemplateTail" | "OpenBraceToken" | "CloseBraceToken" | "OpenParenToken" | "CloseParenToken" | "OpenBracketToken" | "CloseBracketToken" | "DotToken" | "DotDotDotToken" | "SemicolonToken" | "CommaToken" | "QuestionDotToken" | "LessThanToken" | "LessThanSlashToken" | "GreaterThanToken" | "LessThanEqualsToken" | "GreaterThanEqualsToken" | "EqualsEqualsToken" | "ExclamationEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "EqualsGreaterThanToken" | "PlusToken" | "MinusToken" | "AsteriskToken" | "AsteriskAsteriskToken" | "SlashToken" | "PercentToken" | "PlusPlusToken" | "MinusMinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "AmpersandToken" | "BarToken" | "CaretToken" | "ExclamationToken" | "TildeToken" | "AmpersandAmpersandToken" | "BarBarToken" | "QuestionToken" | "ColonToken" | "AtToken" | "QuestionQuestionToken" | "BacktickToken" | "HashToken" | "EqualsToken" | "PlusEqualsToken" | "MinusEqualsToken" | "AsteriskEqualsToken" | "AsteriskAsteriskEqualsToken" | "SlashEqualsToken" | "PercentEqualsToken" | "LessThanLessThanEqualsToken" | "GreaterThanGreaterThanEqualsToken" | "GreaterThanGreaterThanGreaterThanEqualsToken" | "AmpersandEqualsToken" | "BarEqualsToken" | "BarBarEqualsToken" | "AmpersandAmpersandEqualsToken" | "QuestionQuestionEqualsToken" | "CaretEqualsToken" | "Identifier" | "PrivateIdentifier" | "JSDocCommentTextToken" | "BreakKeyword" | "CaseKeyword" | "CatchKeyword" | "ClassKeyword" | "ConstKeyword" | "ContinueKeyword" | "DebuggerKeyword" | "DefaultKeyword" | "DeleteKeyword" | "DoKeyword" | "ElseKeyword" | "EnumKeyword" | "ExportKeyword" | "ExtendsKeyword" | "FalseKeyword" | "FinallyKeyword" | "ForKeyword" | "FunctionKeyword" | "IfKeyword" | "ImportKeyword" | "InKeyword" | "InstanceOfKeyword" | "NewKeyword" | "NullKeyword" | "ReturnKeyword" | "SuperKeyword" | "SwitchKeyword" | "ThisKeyword" | "ThrowKeyword" | "TrueKeyword" | "TryKeyword" | "TypeOfKeyword" | "VarKeyword" | "VoidKeyword" | "WhileKeyword" | "WithKeyword" | "ImplementsKeyword" | "InterfaceKeyword" | "LetKeyword" | "PackageKeyword" | "PrivateKeyword" | "ProtectedKeyword" | "PublicKeyword" | "StaticKeyword" | "YieldKeyword" | "AbstractKeyword" | "AccessorKeyword" | "AsKeyword" | "AssertsKeyword" | "AssertKeyword" | "AnyKeyword" | "AsyncKeyword" | "AwaitKeyword" | "BooleanKeyword" | "ConstructorKeyword" | "DeclareKeyword" | "GetKeyword" | "ImmediateKeyword" | "InferKeyword" | "IntrinsicKeyword" | "IsKeyword" | "KeyOfKeyword" | "ModuleKeyword" | "NamespaceKeyword" | "NeverKeyword" | "OutKeyword" | "ReadonlyKeyword" | "RequireKeyword" | "NumberKeyword" | "ObjectKeyword" | "SatisfiesKeyword" | "SetKeyword" | "StringKeyword" | "SymbolKeyword" | "TypeKeyword" | "UndefinedKeyword" | "UniqueKeyword" | "UnknownKeyword" | "UsingKeyword" | "FromKeyword" | "GlobalKeyword" | "BigIntKeyword" | "OverrideKeyword" | "OfKeyword" | "DeferKeyword";

export type JsxTokenSyntaxKind = "LessThanSlashToken" | "EndOfFile" | "ConflictMarkerTrivia" | "JsxText" | "JsxTextAllWhiteSpaces" | "OpenBraceToken" | "LessThanToken";

export type JSDocNodeSyntaxKind = "JSDocTypeExpression" | "JSDocNameReference" | "JSDocAllType" | "JSDocNullableType" | "JSDocNonNullableType" | "JSDocOptionalType" | "JSDocVariadicType" | "JSDoc" | "JSDocText" | "JSDocTypeLiteral" | "JSDocSignature" | "JSDocLink" | "JSDocLinkCode" | "JSDocLinkPlain" | "JSDocUnknownTag" | "JSDocAugmentsTag" | "JSDocImplementsTag" | "JSDocDeprecatedTag" | "JSDocPublicTag" | "JSDocPrivateTag" | "JSDocProtectedTag" | "JSDocReadonlyTag" | "JSDocOverrideTag" | "JSDocCallbackTag" | "JSDocOverloadTag" | "JSDocParameterTag" | "JSDocReturnTag" | "JSDocThisTag" | "JSDocTypeTag" | "JSDocTemplateTag" | "JSDocTypedefTag" | "JSDocSeeTag" | "JSDocPropertyTag" | "JSDocThrowsTag" | "JSDocSatisfiesTag" | "JSDocImportTag";

export type ImportPhaseModifierSyntaxKind = "TypeKeyword" | "DeferKeyword";

export type PostfixUnaryOperator = "PlusPlusToken" | "MinusMinusToken";

export type PrefixUnaryOperator = "PlusToken" | "MinusToken" | "TildeToken" | "ExclamationToken" | "PlusPlusToken" | "MinusMinusToken";

export type AssignmentOperator = "EqualsToken" | "PlusEqualsToken" | "MinusEqualsToken" | "AsteriskAsteriskEqualsToken" | "AsteriskEqualsToken" | "SlashEqualsToken" | "PercentEqualsToken" | "AmpersandEqualsToken" | "BarEqualsToken" | "CaretEqualsToken" | "LessThanLessThanEqualsToken" | "GreaterThanGreaterThanGreaterThanEqualsToken" | "GreaterThanGreaterThanEqualsToken" | "BarBarEqualsToken" | "AmpersandAmpersandEqualsToken" | "QuestionQuestionEqualsToken";

export type BinaryOperator = "QuestionQuestionToken" | "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "LessThanToken" | "LessThanEqualsToken" | "GreaterThanToken" | "GreaterThanEqualsToken" | "InstanceOfKeyword" | "InKeyword" | "EqualsEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "ExclamationEqualsToken" | "AmpersandToken" | "BarToken" | "CaretToken" | "AmpersandAmpersandToken" | "BarBarToken" | "EqualsToken" | "PlusEqualsToken" | "MinusEqualsToken" | "AsteriskAsteriskEqualsToken" | "AsteriskEqualsToken" | "SlashEqualsToken" | "PercentEqualsToken" | "AmpersandEqualsToken" | "BarEqualsToken" | "CaretEqualsToken" | "LessThanLessThanEqualsToken" | "GreaterThanGreaterThanGreaterThanEqualsToken" | "GreaterThanGreaterThanEqualsToken" | "BarBarEqualsToken" | "AmpersandAmpersandEqualsToken" | "QuestionQuestionEqualsToken" | "CommaToken";

export type ExponentiationOperator = "AsteriskAsteriskToken";

export type MultiplicativeOperator = "AsteriskToken" | "SlashToken" | "PercentToken";

export type MultiplicativeOperatorOrHigher = "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken";

export type AdditiveOperator = "PlusToken" | "MinusToken";

export type AdditiveOperatorOrHigher = "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken";

export type ShiftOperator = "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken";

export type ShiftOperatorOrHigher = "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken";

export type RelationalOperator = "LessThanToken" | "LessThanEqualsToken" | "GreaterThanToken" | "GreaterThanEqualsToken" | "InstanceOfKeyword" | "InKeyword";

export type RelationalOperatorOrHigher = "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "LessThanToken" | "LessThanEqualsToken" | "GreaterThanToken" | "GreaterThanEqualsToken" | "InstanceOfKeyword" | "InKeyword";

export type EqualityOperator = "EqualsEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "ExclamationEqualsToken";

export type EqualityOperatorOrHigher = "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "LessThanToken" | "LessThanEqualsToken" | "GreaterThanToken" | "GreaterThanEqualsToken" | "InstanceOfKeyword" | "InKeyword" | "EqualsEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "ExclamationEqualsToken";

export type BitwiseOperator = "AmpersandToken" | "BarToken" | "CaretToken";

export type BitwiseOperatorOrHigher = "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "LessThanToken" | "LessThanEqualsToken" | "GreaterThanToken" | "GreaterThanEqualsToken" | "InstanceOfKeyword" | "InKeyword" | "EqualsEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "ExclamationEqualsToken" | "AmpersandToken" | "BarToken" | "CaretToken";

export type LogicalOperator = "AmpersandAmpersandToken" | "BarBarToken";

export type LogicalOperatorOrHigher = "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "LessThanToken" | "LessThanEqualsToken" | "GreaterThanToken" | "GreaterThanEqualsToken" | "InstanceOfKeyword" | "InKeyword" | "EqualsEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "ExclamationEqualsToken" | "AmpersandToken" | "BarToken" | "CaretToken" | "AmpersandAmpersandToken" | "BarBarToken";

export type CompoundAssignmentOperator = "PlusEqualsToken" | "MinusEqualsToken" | "AsteriskAsteriskEqualsToken" | "AsteriskEqualsToken" | "SlashEqualsToken" | "PercentEqualsToken" | "AmpersandEqualsToken" | "BarEqualsToken" | "CaretEqualsToken" | "LessThanLessThanEqualsToken" | "GreaterThanGreaterThanGreaterThanEqualsToken" | "GreaterThanGreaterThanEqualsToken" | "BarBarEqualsToken" | "AmpersandAmpersandEqualsToken" | "QuestionQuestionEqualsToken";

export type AssignmentOperatorOrHigher = "QuestionQuestionToken" | "AsteriskAsteriskToken" | "AsteriskToken" | "SlashToken" | "PercentToken" | "PlusToken" | "MinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "LessThanToken" | "LessThanEqualsToken" | "GreaterThanToken" | "GreaterThanEqualsToken" | "InstanceOfKeyword" | "InKeyword" | "EqualsEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "ExclamationEqualsToken" | "AmpersandToken" | "BarToken" | "CaretToken" | "AmpersandAmpersandToken" | "BarBarToken" | "EqualsToken" | "PlusEqualsToken" | "MinusEqualsToken" | "AsteriskAsteriskEqualsToken" | "AsteriskEqualsToken" | "SlashEqualsToken" | "PercentEqualsToken" | "AmpersandEqualsToken" | "BarEqualsToken" | "CaretEqualsToken" | "LessThanLessThanEqualsToken" | "GreaterThanGreaterThanGreaterThanEqualsToken" | "GreaterThanGreaterThanEqualsToken" | "BarBarEqualsToken" | "AmpersandAmpersandEqualsToken" | "QuestionQuestionEqualsToken";

export type LogicalOrCoalescingAssignmentOperator = "AmpersandAmpersandEqualsToken" | "BarBarEqualsToken" | "QuestionQuestionEqualsToken";

export type PlainTokenKind = "Unknown" | "EndOfFile" | "SingleLineCommentTrivia" | "MultiLineCommentTrivia" | "NewLineTrivia" | "WhitespaceTrivia" | "ConflictMarkerTrivia" | "NonTextFileMarkerTrivia" | "JsxTextAllWhiteSpaces" | "OpenBraceToken" | "CloseBraceToken" | "OpenParenToken" | "CloseParenToken" | "OpenBracketToken" | "CloseBracketToken" | "DotToken" | "DotDotDotToken" | "SemicolonToken" | "CommaToken" | "QuestionDotToken" | "LessThanToken" | "LessThanSlashToken" | "GreaterThanToken" | "LessThanEqualsToken" | "GreaterThanEqualsToken" | "EqualsEqualsToken" | "ExclamationEqualsToken" | "EqualsEqualsEqualsToken" | "ExclamationEqualsEqualsToken" | "EqualsGreaterThanToken" | "PlusToken" | "MinusToken" | "AsteriskToken" | "AsteriskAsteriskToken" | "SlashToken" | "PercentToken" | "PlusPlusToken" | "MinusMinusToken" | "LessThanLessThanToken" | "GreaterThanGreaterThanToken" | "GreaterThanGreaterThanGreaterThanToken" | "AmpersandToken" | "BarToken" | "CaretToken" | "ExclamationToken" | "TildeToken" | "AmpersandAmpersandToken" | "BarBarToken" | "QuestionToken" | "ColonToken" | "AtToken" | "QuestionQuestionToken" | "BacktickToken" | "HashToken" | "EqualsToken" | "PlusEqualsToken" | "MinusEqualsToken" | "AsteriskEqualsToken" | "AsteriskAsteriskEqualsToken" | "SlashEqualsToken" | "PercentEqualsToken" | "LessThanLessThanEqualsToken" | "GreaterThanGreaterThanEqualsToken" | "GreaterThanGreaterThanGreaterThanEqualsToken" | "AmpersandEqualsToken" | "BarEqualsToken" | "BarBarEqualsToken" | "AmpersandAmpersandEqualsToken" | "QuestionQuestionEqualsToken" | "CaretEqualsToken" | "JSDocCommentTextToken" | "BreakKeyword" | "CaseKeyword" | "CatchKeyword" | "ClassKeyword" | "ConstKeyword" | "ContinueKeyword" | "DebuggerKeyword" | "DefaultKeyword" | "DeleteKeyword" | "DoKeyword" | "ElseKeyword" | "EnumKeyword" | "ExportKeyword" | "ExtendsKeyword" | "FinallyKeyword" | "ForKeyword" | "FunctionKeyword" | "IfKeyword" | "InKeyword" | "InstanceOfKeyword" | "NewKeyword" | "ReturnKeyword" | "SwitchKeyword" | "ThrowKeyword" | "TryKeyword" | "TypeOfKeyword" | "VarKeyword" | "WhileKeyword" | "WithKeyword" | "ImplementsKeyword" | "InterfaceKeyword" | "LetKeyword" | "PackageKeyword" | "PrivateKeyword" | "ProtectedKeyword" | "PublicKeyword" | "StaticKeyword" | "YieldKeyword" | "AbstractKeyword" | "AccessorKeyword" | "AsKeyword" | "AssertsKeyword" | "AssertKeyword" | "AsyncKeyword" | "AwaitKeyword" | "ConstructorKeyword" | "DeclareKeyword" | "GetKeyword" | "ImmediateKeyword" | "InferKeyword" | "IsKeyword" | "KeyOfKeyword" | "ModuleKeyword" | "NamespaceKeyword" | "OutKeyword" | "ReadonlyKeyword" | "RequireKeyword" | "SatisfiesKeyword" | "SetKeyword" | "TypeKeyword" | "UniqueKeyword" | "UsingKeyword" | "FromKeyword" | "GlobalKeyword" | "OverrideKeyword" | "OfKeyword" | "DeferKeyword";

export interface NodeHeader {
  readonly id: NodeId;
  readonly origin: Origin;
  readonly parent: NodeId | null;
  readonly flags: readonly SyntaxFlag[];
  readonly loc: TextRange;
}

export interface NodeList<Item> {
  readonly loc: TextRange;
  readonly nodes: readonly Item[];
}

export interface ModifierList<P extends Phase> extends NodeList<ModifierLike<P>> {}

export interface Phase {
  readonly Token: object | null;
  readonly ParameterInitializer: object | null;
  readonly CallArguments: { readonly loc: TextRange };
  readonly Identifier: object | null;
  readonly PrivateIdentifier: object | null;
  readonly QualifiedName: object | null;
  readonly ComputedPropertyName: object | null;
  readonly Decorator: object | null;
  readonly EmptyStatement: object | null;
  readonly IfStatement: object | null;
  readonly DoStatement: object | null;
  readonly WhileStatement: object | null;
  readonly ForStatement: object | null;
  readonly ForInOrOfStatement: object | null;
  readonly BreakStatement: object | null;
  readonly ContinueStatement: object | null;
  readonly ReturnStatement: object | null;
  readonly WithStatement: object | null;
  readonly SwitchStatement: object | null;
  readonly CaseBlock: object | null;
  readonly CaseClause: object | null;
  readonly ThrowStatement: object | null;
  readonly TryStatement: object | null;
  readonly CatchClause: object | null;
  readonly DebuggerStatement: object | null;
  readonly LabeledStatement: object | null;
  readonly ExpressionStatement: object | null;
  readonly Block: object | null;
  readonly VariableStatement: object | null;
  readonly VariableDeclaration: object | null;
  readonly VariableDeclarationList: object | null;
  readonly BindingPattern: object | null;
  readonly ParameterDeclaration: object | null;
  readonly BindingElement: object | null;
  readonly MissingDeclaration: object | null;
  readonly FunctionDeclaration: object | null;
  readonly ClassDeclaration: object | null;
  readonly ClassExpression: object | null;
  readonly HeritageClause: object | null;
  readonly InterfaceDeclaration: object | null;
  readonly TypeAliasDeclaration: object | null;
  readonly EnumMember: object | null;
  readonly EnumDeclaration: object | null;
  readonly ModuleBlock: object | null;
  readonly NotEmittedStatement: object | null;
  readonly NotEmittedTypeElement: object | null;
  readonly ImportDeclaration: object | null;
  readonly ExternalModuleReference: object | null;
  readonly NamespaceImport: object | null;
  readonly NamedImports: object | null;
  readonly ExportAssignment: object | null;
  readonly NamespaceExportDeclaration: object | null;
  readonly NamespaceExport: object | null;
  readonly NamedExports: object | null;
  readonly ExportSpecifier: object | null;
  readonly CallSignatureDeclaration: object | null;
  readonly ConstructSignatureDeclaration: object | null;
  readonly ConstructorDeclaration: object | null;
  readonly GetAccessorDeclaration: object | null;
  readonly SetAccessorDeclaration: object | null;
  readonly IndexSignatureDeclaration: object | null;
  readonly MethodSignatureDeclaration: object | null;
  readonly MethodDeclaration: object | null;
  readonly PropertySignatureDeclaration: object | null;
  readonly PropertyDeclaration: object | null;
  readonly SemicolonClassElement: object | null;
  readonly ClassStaticBlockDeclaration: object | null;
  readonly OmittedExpression: object | null;
  readonly ExcludedExpression: null;
  readonly KeywordExpression: object | null;
  readonly StringLiteral: object | null;
  readonly NumericLiteral: object | null;
  readonly BigIntLiteral: object | null;
  readonly RegularExpressionLiteral: object | null;
  readonly NoSubstitutionTemplateLiteral: object | null;
  readonly BinaryExpression: object | null;
  readonly PrefixUnaryExpression: object | null;
  readonly PostfixUnaryExpression: object | null;
  readonly YieldExpression: object | null;
  readonly ArrowFunction: object | null;
  readonly FunctionExpression: object | null;
  readonly AsExpression: object | null;
  readonly SatisfiesExpression: object | null;
  readonly ConditionalExpression: object | null;
  readonly PropertyAccessExpression: object | null;
  readonly ElementAccessExpression: object | null;
  readonly CallExpression: object | null;
  readonly NewExpression: object | null;
  readonly MetaProperty: object | null;
  readonly NonNullExpression: object | null;
  readonly SpreadElement: object | null;
  readonly TemplateExpression: object | null;
  readonly TemplateSpan: object | null;
  readonly TaggedTemplateExpression: object | null;
  readonly ParenthesizedExpression: object | null;
  readonly ArrayLiteralExpression: object | null;
  readonly ObjectLiteralExpression: object | null;
  readonly SpreadAssignment: object | null;
  readonly PropertyAssignment: object | null;
  readonly ShorthandPropertyAssignment: object | null;
  readonly DeleteExpression: object | null;
  readonly TypeOfExpression: object | null;
  readonly VoidExpression: object | null;
  readonly AwaitExpression: object | null;
  readonly TypeAssertion: object | null;
  readonly KeywordTypeNode: object | null;
  readonly UnionTypeNode: object | null;
  readonly IntersectionTypeNode: object | null;
  readonly ConditionalTypeNode: object | null;
  readonly TypeOperatorNode: object | null;
  readonly InferTypeNode: object | null;
  readonly ArrayTypeNode: object | null;
  readonly IndexedAccessTypeNode: object | null;
  readonly TypeReferenceNode: object | null;
  readonly ExpressionWithTypeArguments: object | null;
  readonly LiteralTypeNode: object | null;
  readonly ThisTypeNode: object | null;
  readonly TypePredicateNode: object | null;
  readonly ImportAttribute: object | null;
  readonly ImportAttributes: object | null;
  readonly TypeQueryNode: object | null;
  readonly MappedTypeNode: object | null;
  readonly TypeLiteralNode: object | null;
  readonly TupleTypeNode: object | null;
  readonly NamedTupleMember: object | null;
  readonly OptionalTypeNode: object | null;
  readonly RestTypeNode: object | null;
  readonly ParenthesizedTypeNode: object | null;
  readonly FunctionTypeNode: object | null;
  readonly ConstructorTypeNode: object | null;
  readonly TemplateHead: object | null;
  readonly TemplateMiddle: object | null;
  readonly TemplateTail: object | null;
  readonly TemplateLiteralTypeNode: object | null;
  readonly TemplateLiteralTypeSpan: object | null;
  readonly PartiallyEmittedExpression: object | null;
  readonly JsxElement: object | null;
  readonly JsxAttributes: object | null;
  readonly JsxNamespacedName: object | null;
  readonly JsxOpeningElement: object | null;
  readonly JsxSelfClosingElement: object | null;
  readonly JsxFragment: object | null;
  readonly JsxOpeningFragment: object | null;
  readonly JsxClosingFragment: object | null;
  readonly JsxAttribute: object | null;
  readonly JsxSpreadAttribute: object | null;
  readonly JsxClosingElement: object | null;
  readonly JsxExpression: object | null;
  readonly JsxText: object | null;
  readonly SyntaxList: object | null;
  readonly JSDoc: object | null;
  readonly JSDocTypeExpression: object | null;
  readonly JSDocNonNullableType: object | null;
  readonly JSDocNullableType: object | null;
  readonly JSDocAllType: object | null;
  readonly JSDocVariadicType: object | null;
  readonly JSDocOptionalType: object | null;
  readonly JSDocTypeTag: object | null;
  readonly JSDocUnknownTag: object | null;
  readonly JSDocTemplateTag: object | null;
  readonly JSDocReturnTag: object | null;
  readonly JSDocPublicTag: object | null;
  readonly JSDocPrivateTag: object | null;
  readonly JSDocProtectedTag: object | null;
  readonly JSDocReadonlyTag: object | null;
  readonly JSDocOverrideTag: object | null;
  readonly JSDocDeprecatedTag: object | null;
  readonly JSDocSeeTag: object | null;
  readonly JSDocImplementsTag: object | null;
  readonly JSDocAugmentsTag: object | null;
  readonly JSDocSatisfiesTag: object | null;
  readonly JSDocThrowsTag: object | null;
  readonly JSDocThisTag: object | null;
  readonly JSDocImportTag: object | null;
  readonly JSDocCallbackTag: object | null;
  readonly JSDocOverloadTag: object | null;
  readonly JSDocTypedefTag: object | null;
  readonly JSDocSignature: object | null;
  readonly JSDocNameReference: object | null;
  readonly SourceFile: object | null;
  readonly ModuleDeclaration: object | null;
  readonly ImportEqualsDeclaration: object | null;
  readonly ExportDeclaration: object | null;
  readonly ImportTypeNode: object | null;
  readonly ImportClause: object | null;
  readonly ImportSpecifier: object | null;
  readonly JSDocText: object | null;
  readonly JSDocLink: object | null;
  readonly JSDocLinkPlain: object | null;
  readonly JSDocLinkCode: object | null;
  readonly TypeParameterDeclaration: object | null;
  readonly SyntheticReferenceExpression: object | null;
  readonly JSDocTypeLiteral: object | null;
  readonly JSDocParameterOrPropertyTag: object | null;
}

export interface SyntaxPhase extends Phase {
  readonly Token: null;
  readonly ParameterInitializer: Expression<SyntaxPhase> | null;
  readonly CallArguments: NodeList<Expression<SyntaxPhase>>;
  readonly Identifier: null;
  readonly PrivateIdentifier: null;
  readonly QualifiedName: null;
  readonly ComputedPropertyName: null;
  readonly Decorator: null;
  readonly EmptyStatement: null;
  readonly IfStatement: null;
  readonly DoStatement: null;
  readonly WhileStatement: null;
  readonly ForStatement: null;
  readonly ForInOrOfStatement: null;
  readonly BreakStatement: null;
  readonly ContinueStatement: null;
  readonly ReturnStatement: null;
  readonly WithStatement: null;
  readonly SwitchStatement: null;
  readonly CaseBlock: null;
  readonly CaseClause: null;
  readonly ThrowStatement: null;
  readonly TryStatement: null;
  readonly CatchClause: null;
  readonly DebuggerStatement: null;
  readonly LabeledStatement: null;
  readonly ExpressionStatement: null;
  readonly Block: null;
  readonly VariableStatement: null;
  readonly VariableDeclaration: null;
  readonly VariableDeclarationList: null;
  readonly BindingPattern: null;
  readonly ParameterDeclaration: null;
  readonly BindingElement: null;
  readonly MissingDeclaration: null;
  readonly FunctionDeclaration: null;
  readonly ClassDeclaration: null;
  readonly ClassExpression: null;
  readonly HeritageClause: null;
  readonly InterfaceDeclaration: null;
  readonly TypeAliasDeclaration: null;
  readonly EnumMember: null;
  readonly EnumDeclaration: null;
  readonly ModuleBlock: null;
  readonly NotEmittedStatement: null;
  readonly NotEmittedTypeElement: null;
  readonly ImportDeclaration: null;
  readonly ExternalModuleReference: null;
  readonly NamespaceImport: null;
  readonly NamedImports: null;
  readonly ExportAssignment: null;
  readonly NamespaceExportDeclaration: null;
  readonly NamespaceExport: null;
  readonly NamedExports: null;
  readonly ExportSpecifier: null;
  readonly CallSignatureDeclaration: null;
  readonly ConstructSignatureDeclaration: null;
  readonly ConstructorDeclaration: null;
  readonly GetAccessorDeclaration: null;
  readonly SetAccessorDeclaration: null;
  readonly IndexSignatureDeclaration: null;
  readonly MethodSignatureDeclaration: null;
  readonly MethodDeclaration: null;
  readonly PropertySignatureDeclaration: null;
  readonly PropertyDeclaration: null;
  readonly SemicolonClassElement: null;
  readonly ClassStaticBlockDeclaration: null;
  readonly OmittedExpression: null;
  readonly KeywordExpression: null;
  readonly StringLiteral: null;
  readonly NumericLiteral: null;
  readonly BigIntLiteral: null;
  readonly RegularExpressionLiteral: null;
  readonly NoSubstitutionTemplateLiteral: null;
  readonly BinaryExpression: null;
  readonly PrefixUnaryExpression: null;
  readonly PostfixUnaryExpression: null;
  readonly YieldExpression: null;
  readonly ArrowFunction: null;
  readonly FunctionExpression: null;
  readonly AsExpression: null;
  readonly SatisfiesExpression: null;
  readonly ConditionalExpression: null;
  readonly PropertyAccessExpression: null;
  readonly ElementAccessExpression: null;
  readonly CallExpression: null;
  readonly NewExpression: null;
  readonly MetaProperty: null;
  readonly NonNullExpression: null;
  readonly SpreadElement: null;
  readonly TemplateExpression: null;
  readonly TemplateSpan: null;
  readonly TaggedTemplateExpression: null;
  readonly ParenthesizedExpression: null;
  readonly ArrayLiteralExpression: null;
  readonly ObjectLiteralExpression: null;
  readonly SpreadAssignment: null;
  readonly PropertyAssignment: null;
  readonly ShorthandPropertyAssignment: null;
  readonly DeleteExpression: null;
  readonly TypeOfExpression: null;
  readonly VoidExpression: null;
  readonly AwaitExpression: null;
  readonly TypeAssertion: null;
  readonly KeywordTypeNode: null;
  readonly UnionTypeNode: null;
  readonly IntersectionTypeNode: null;
  readonly ConditionalTypeNode: null;
  readonly TypeOperatorNode: null;
  readonly InferTypeNode: null;
  readonly ArrayTypeNode: null;
  readonly IndexedAccessTypeNode: null;
  readonly TypeReferenceNode: null;
  readonly ExpressionWithTypeArguments: null;
  readonly LiteralTypeNode: null;
  readonly ThisTypeNode: null;
  readonly TypePredicateNode: null;
  readonly ImportAttribute: null;
  readonly ImportAttributes: null;
  readonly TypeQueryNode: null;
  readonly MappedTypeNode: null;
  readonly TypeLiteralNode: null;
  readonly TupleTypeNode: null;
  readonly NamedTupleMember: null;
  readonly OptionalTypeNode: null;
  readonly RestTypeNode: null;
  readonly ParenthesizedTypeNode: null;
  readonly FunctionTypeNode: null;
  readonly ConstructorTypeNode: null;
  readonly TemplateHead: null;
  readonly TemplateMiddle: null;
  readonly TemplateTail: null;
  readonly TemplateLiteralTypeNode: null;
  readonly TemplateLiteralTypeSpan: null;
  readonly PartiallyEmittedExpression: null;
  readonly JsxElement: null;
  readonly JsxAttributes: null;
  readonly JsxNamespacedName: null;
  readonly JsxOpeningElement: null;
  readonly JsxSelfClosingElement: null;
  readonly JsxFragment: null;
  readonly JsxOpeningFragment: null;
  readonly JsxClosingFragment: null;
  readonly JsxAttribute: null;
  readonly JsxSpreadAttribute: null;
  readonly JsxClosingElement: null;
  readonly JsxExpression: null;
  readonly JsxText: null;
  readonly SyntaxList: null;
  readonly JSDoc: null;
  readonly JSDocTypeExpression: null;
  readonly JSDocNonNullableType: null;
  readonly JSDocNullableType: null;
  readonly JSDocAllType: null;
  readonly JSDocVariadicType: null;
  readonly JSDocOptionalType: null;
  readonly JSDocTypeTag: null;
  readonly JSDocUnknownTag: null;
  readonly JSDocTemplateTag: null;
  readonly JSDocReturnTag: null;
  readonly JSDocPublicTag: null;
  readonly JSDocPrivateTag: null;
  readonly JSDocProtectedTag: null;
  readonly JSDocReadonlyTag: null;
  readonly JSDocOverrideTag: null;
  readonly JSDocDeprecatedTag: null;
  readonly JSDocSeeTag: null;
  readonly JSDocImplementsTag: null;
  readonly JSDocAugmentsTag: null;
  readonly JSDocSatisfiesTag: null;
  readonly JSDocThrowsTag: null;
  readonly JSDocThisTag: null;
  readonly JSDocImportTag: null;
  readonly JSDocCallbackTag: null;
  readonly JSDocOverloadTag: null;
  readonly JSDocTypedefTag: null;
  readonly JSDocSignature: null;
  readonly JSDocNameReference: null;
  readonly SourceFile: null;
  readonly ModuleDeclaration: null;
  readonly ImportEqualsDeclaration: null;
  readonly ExportDeclaration: null;
  readonly ImportTypeNode: null;
  readonly ImportClause: null;
  readonly ImportSpecifier: null;
  readonly JSDocText: null;
  readonly JSDocLink: null;
  readonly JSDocLinkPlain: null;
  readonly JSDocLinkCode: null;
  readonly TypeParameterDeclaration: null;
  readonly SyntheticReferenceExpression: null;
  readonly JSDocTypeLiteral: null;
  readonly JSDocParameterOrPropertyTag: null;
}

export interface Token<P extends Phase, K extends TokenSyntaxKind = PlainTokenKind> extends NodeHeader {
  readonly kind: K;
  readonly tsonic: P["Token"];
}

export interface Identifier<P extends Phase> extends NodeHeader {
  readonly kind: "Identifier";
  readonly text: string;
  readonly tsonic: P["Identifier"];
}

export interface PrivateIdentifier<P extends Phase> extends NodeHeader {
  readonly kind: "PrivateIdentifier";
  readonly text: string;
  readonly tsonic: P["PrivateIdentifier"];
}

export interface QualifiedName<P extends Phase> extends NodeHeader {
  readonly kind: "QualifiedName";
  readonly left: EntityName<P>;
  readonly right: Identifier<P>;
  readonly tsonic: P["QualifiedName"];
}

export interface ComputedPropertyName<P extends Phase> extends NodeHeader {
  readonly kind: "ComputedPropertyName";
  readonly expression: Expression<P>;
  readonly tsonic: P["ComputedPropertyName"];
}

export interface Decorator<P extends Phase> extends NodeHeader {
  readonly kind: "Decorator";
  readonly expression: LeftHandSideExpression<P>;
  readonly tsonic: P["Decorator"];
}

export interface EmptyStatement<P extends Phase> extends NodeHeader {
  readonly kind: "EmptyStatement";
  readonly tsonic: P["EmptyStatement"];
}

export interface IfStatement<P extends Phase> extends NodeHeader {
  readonly kind: "IfStatement";
  readonly expression: Expression<P>;
  readonly thenStatement: Statement<P>;
  readonly elseStatement: Statement<P> | null;
  readonly tsonic: P["IfStatement"];
}

export interface DoStatement<P extends Phase> extends NodeHeader {
  readonly kind: "DoStatement";
  readonly statement: Statement<P>;
  readonly expression: Expression<P>;
  readonly tsonic: P["DoStatement"];
}

export interface WhileStatement<P extends Phase> extends NodeHeader {
  readonly kind: "WhileStatement";
  readonly statement: Statement<P>;
  readonly expression: Expression<P>;
  readonly tsonic: P["WhileStatement"];
}

export interface ForStatement<P extends Phase> extends NodeHeader {
  readonly kind: "ForStatement";
  readonly statement: Statement<P>;
  readonly initializer: ForInitializer<P> | null;
  readonly condition: Expression<P> | null;
  readonly incrementor: Expression<P> | null;
  readonly tsonic: P["ForStatement"];
}

export interface ForInStatement<P extends Phase> extends NodeHeader {
  readonly kind: "ForInStatement";
  readonly awaitModifier: null;
  readonly initializer: ForInitializer<P>;
  readonly expression: Expression<P>;
  readonly statement: Statement<P>;
  readonly tsonic: P["ForInOrOfStatement"];
}

export interface ForOfStatement<P extends Phase> extends NodeHeader {
  readonly kind: "ForOfStatement";
  readonly awaitModifier: AwaitKeyword<P> | null;
  readonly initializer: ForInitializer<P>;
  readonly expression: Expression<P>;
  readonly statement: Statement<P>;
  readonly tsonic: P["ForInOrOfStatement"];
}

export type ForInOrOfStatement<P extends Phase> = ForInStatement<P> | ForOfStatement<P>;

export interface BreakStatement<P extends Phase> extends NodeHeader {
  readonly kind: "BreakStatement";
  readonly label: Identifier<P> | null;
  readonly tsonic: P["BreakStatement"];
}

export interface ContinueStatement<P extends Phase> extends NodeHeader {
  readonly kind: "ContinueStatement";
  readonly label: Identifier<P> | null;
  readonly tsonic: P["ContinueStatement"];
}

export interface ReturnStatement<P extends Phase> extends NodeHeader {
  readonly kind: "ReturnStatement";
  readonly expression: Expression<P> | null;
  readonly tsonic: P["ReturnStatement"];
}

export interface WithStatement<P extends Phase> extends NodeHeader {
  readonly kind: "WithStatement";
  readonly expression: Expression<P>;
  readonly statement: Statement<P>;
  readonly tsonic: P["WithStatement"];
}

export interface SwitchStatement<P extends Phase> extends NodeHeader {
  readonly kind: "SwitchStatement";
  readonly expression: Expression<P>;
  readonly caseBlock: CaseBlock<P>;
  readonly tsonic: P["SwitchStatement"];
}

export interface CaseBlock<P extends Phase> extends NodeHeader {
  readonly kind: "CaseBlock";
  readonly clauses: NodeList<CaseOrDefaultClause<P>>;
  readonly tsonic: P["CaseBlock"];
}

export interface CaseClause<P extends Phase> extends NodeHeader {
  readonly kind: "CaseClause";
  readonly expression: Expression<P>;
  readonly statements: NodeList<Statement<P>>;
  readonly tsonic: P["CaseClause"];
}

export interface DefaultClause<P extends Phase> extends NodeHeader {
  readonly kind: "DefaultClause";
  readonly expression: null;
  readonly statements: NodeList<Statement<P>>;
  readonly tsonic: null;
}

export type CaseOrDefaultClause<P extends Phase> = CaseClause<P> | DefaultClause<P>;

export interface ThrowStatement<P extends Phase> extends NodeHeader {
  readonly kind: "ThrowStatement";
  readonly expression: Expression<P>;
  readonly tsonic: P["ThrowStatement"];
}

export interface TryStatement<P extends Phase> extends NodeHeader {
  readonly kind: "TryStatement";
  readonly tryBlock: Block<P>;
  readonly catchClause: CatchClause<P> | null;
  readonly finallyBlock: Block<P> | null;
  readonly tsonic: P["TryStatement"];
}

export interface CatchClause<P extends Phase> extends NodeHeader {
  readonly kind: "CatchClause";
  readonly variableDeclaration: VariableDeclaration<P> | null;
  readonly block: Block<P>;
  readonly tsonic: P["CatchClause"];
}

export interface DebuggerStatement<P extends Phase> extends NodeHeader {
  readonly kind: "DebuggerStatement";
  readonly tsonic: P["DebuggerStatement"];
}

export interface LabeledStatement<P extends Phase> extends NodeHeader {
  readonly kind: "LabeledStatement";
  readonly label: Identifier<P>;
  readonly statement: Statement<P>;
  readonly tsonic: P["LabeledStatement"];
}

export interface ExpressionStatement<P extends Phase> extends NodeHeader {
  readonly kind: "ExpressionStatement";
  readonly expression: Expression<P>;
  readonly tsonic: P["ExpressionStatement"];
}

export interface Block<P extends Phase> extends NodeHeader {
  readonly kind: "Block";
  readonly statements: NodeList<Statement<P>>;
  readonly multiLine: boolean;
  readonly tsonic: P["Block"];
}

export interface VariableStatement<P extends Phase> extends NodeHeader {
  readonly kind: "VariableStatement";
  readonly modifiers: ModifierList<P> | null;
  readonly declarationList: VariableDeclarationList<P>;
  readonly tsonic: P["VariableStatement"];
}

export interface VariableDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "VariableDeclaration";
  readonly name: BindingName<P>;
  readonly exclamationToken: ExclamationToken<P> | null;
  readonly type: TypeNode<P> | null;
  readonly initializer: Expression<P> | null;
  readonly tsonic: P["VariableDeclaration"];
}

export interface VariableDeclarationList<P extends Phase> extends NodeHeader {
  readonly kind: "VariableDeclarationList";
  readonly declarations: NodeList<VariableDeclaration<P>>;
  readonly tsonic: P["VariableDeclarationList"];
}

export interface BindingPattern<P extends Phase, K extends "ObjectBindingPattern" | "ArrayBindingPattern" = "ObjectBindingPattern" | "ArrayBindingPattern"> extends NodeHeader {
  readonly kind: K;
  readonly elements: NodeList<BindingElement<P>>;
  readonly tsonic: P["BindingPattern"];
}

export interface ParameterDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "Parameter";
  readonly modifiers: ModifierList<P> | null;
  readonly dotDotDotToken: DotDotDotToken<P> | null;
  readonly name: BindingName<P>;
  readonly questionToken: QuestionToken<P> | null;
  readonly type: TypeNode<P> | null;
  readonly initializer: P["ParameterInitializer"];
  readonly tsonic: P["ParameterDeclaration"];
}

export interface BindingElement<P extends Phase> extends NodeHeader {
  readonly kind: "BindingElement";
  readonly dotDotDotToken: DotDotDotToken<P> | null;
  readonly propertyName: PropertyName<P> | null;
  readonly name: BindingName<P> | null;
  readonly initializer: Expression<P> | null;
  readonly tsonic: P["BindingElement"];
}

export interface MissingDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "MissingDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly tsonic: P["MissingDeclaration"];
}

export interface FunctionDeclarationFields<P extends Phase> extends NodeHeader {
  readonly modifiers: ModifierList<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly name: Identifier<P> | null;
}

export interface FunctionDeclarationHeader<P extends Phase> extends FunctionDeclarationFields<P> {
  readonly kind: "FunctionDeclaration";
  readonly tsonic: P["FunctionDeclaration"];
}

export interface FunctionDeclaration<P extends Phase> extends FunctionDeclarationHeader<P> {
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly body: BlockOrExpression<P> | null;
}

export interface ClassDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "ClassDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly name: Identifier<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly heritageClauses: NodeList<HeritageClause<P>> | null;
  readonly members: NodeList<ClassElement<P>>;
  readonly tsonic: P["ClassDeclaration"];
}

export interface ClassExpression<P extends Phase> extends NodeHeader {
  readonly kind: "ClassExpression";
  readonly modifiers: ModifierList<P> | null;
  readonly name: Identifier<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly heritageClauses: NodeList<HeritageClause<P>> | null;
  readonly members: NodeList<ClassElement<P>>;
  readonly tsonic: P["ClassExpression"];
}

export interface HeritageClause<P extends Phase> extends NodeHeader {
  readonly kind: "HeritageClause";
  readonly token: "ExtendsKeyword" | "ImplementsKeyword";
  readonly types: NodeList<ExpressionWithTypeArguments<P>>;
  readonly tsonic: P["HeritageClause"];
}

export interface InterfaceDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "InterfaceDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly name: Identifier<P>;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly heritageClauses: NodeList<HeritageClause<P>> | null;
  readonly members: NodeList<TypeElement<P>>;
  readonly tsonic: P["InterfaceDeclaration"];
}

export interface TypeAliasDeclaration<P extends Phase, K extends "TypeAliasDeclaration" | "JSTypeAliasDeclaration" = "TypeAliasDeclaration" | "JSTypeAliasDeclaration"> extends NodeHeader {
  readonly kind: K;
  readonly modifiers: ModifierList<P> | null;
  readonly name: Identifier<P>;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly type: TypeNode<P>;
  readonly tsonic: P["TypeAliasDeclaration"];
}

export interface EnumMember<P extends Phase> extends NodeHeader {
  readonly kind: "EnumMember";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly initializer: Expression<P> | null;
  readonly tsonic: P["EnumMember"];
}

export interface EnumDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "EnumDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly name: Identifier<P>;
  readonly members: NodeList<EnumMember<P>>;
  readonly tsonic: P["EnumDeclaration"];
}

export interface ModuleBlock<P extends Phase> extends NodeHeader {
  readonly kind: "ModuleBlock";
  readonly statements: NodeList<Statement<P>>;
  readonly tsonic: P["ModuleBlock"];
}

export interface NotEmittedStatement<P extends Phase> extends NodeHeader {
  readonly kind: "NotEmittedStatement";
  readonly tsonic: P["NotEmittedStatement"];
}

export interface NotEmittedTypeElement<P extends Phase> extends NodeHeader {
  readonly kind: "NotEmittedTypeElement";
  readonly tsonic: P["NotEmittedTypeElement"];
}

export interface ImportDeclaration<P extends Phase, K extends "ImportDeclaration" | "JSImportDeclaration" = "ImportDeclaration" | "JSImportDeclaration"> extends NodeHeader {
  readonly kind: K;
  readonly modifiers: ModifierList<P> | null;
  readonly importClause: ImportClause<P> | null;
  readonly moduleSpecifier: Expression<P>;
  readonly attributes: ImportAttributes<P> | null;
  readonly tsonic: P["ImportDeclaration"];
}

export interface ExternalModuleReference<P extends Phase> extends NodeHeader {
  readonly kind: "ExternalModuleReference";
  readonly expression: Expression<P>;
  readonly tsonic: P["ExternalModuleReference"];
}

export interface NamespaceImport<P extends Phase> extends NodeHeader {
  readonly kind: "NamespaceImport";
  readonly name: Identifier<P>;
  readonly tsonic: P["NamespaceImport"];
}

export interface NamedImports<P extends Phase> extends NodeHeader {
  readonly kind: "NamedImports";
  readonly elements: NodeList<ImportSpecifier<P>>;
  readonly tsonic: P["NamedImports"];
}

export interface ExportAssignment<P extends Phase> extends NodeHeader {
  readonly kind: "ExportAssignment";
  readonly modifiers: ModifierList<P> | null;
  readonly isExportEquals: boolean;
  readonly type: TypeNode<P> | null;
  readonly expression: Expression<P>;
  readonly tsonic: P["ExportAssignment"];
}

export interface NamespaceExportDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "NamespaceExportDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly name: Identifier<P>;
  readonly tsonic: P["NamespaceExportDeclaration"];
}

export interface NamespaceExport<P extends Phase> extends NodeHeader {
  readonly kind: "NamespaceExport";
  readonly name: ModuleExportName<P>;
  readonly tsonic: P["NamespaceExport"];
}

export interface NamedExports<P extends Phase> extends NodeHeader {
  readonly kind: "NamedExports";
  readonly elements: NodeList<ExportSpecifier<P>>;
  readonly tsonic: P["NamedExports"];
}

export interface ExportSpecifier<P extends Phase> extends NodeHeader {
  readonly kind: "ExportSpecifier";
  readonly isTypeOnly: boolean;
  readonly propertyName: ModuleExportName<P> | null;
  readonly name: ModuleExportName<P>;
  readonly tsonic: P["ExportSpecifier"];
}

export interface CallSignatureDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "CallSignature";
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly tsonic: P["CallSignatureDeclaration"];
}

export interface ConstructSignatureDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "ConstructSignature";
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly tsonic: P["ConstructSignatureDeclaration"];
}

export interface ConstructorDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "Constructor";
  readonly modifiers: ModifierList<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly body: BlockOrExpression<P> | null;
  readonly tsonic: P["ConstructorDeclaration"];
}

export interface GetAccessorDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "GetAccessor";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly body: BlockOrExpression<P> | null;
  readonly tsonic: P["GetAccessorDeclaration"];
}

export interface SetAccessorDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "SetAccessor";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly body: BlockOrExpression<P> | null;
  readonly tsonic: P["SetAccessorDeclaration"];
}

export interface IndexSignatureDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "IndexSignature";
  readonly modifiers: ModifierList<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly tsonic: P["IndexSignatureDeclaration"];
}

export interface MethodSignatureDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "MethodSignature";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly tsonic: P["MethodSignatureDeclaration"];
}

export interface MethodDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "MethodDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly body: BlockOrExpression<P> | null;
  readonly tsonic: P["MethodDeclaration"];
}

export interface PropertySignatureDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "PropertySignature";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly type: TypeNode<P> | null;
  readonly initializer: Expression<P> | null;
  readonly tsonic: P["PropertySignatureDeclaration"];
}

export interface PropertyDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "PropertyDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly type: TypeNode<P> | null;
  readonly initializer: Expression<P> | null;
  readonly tsonic: P["PropertyDeclaration"];
}

export interface SemicolonClassElement<P extends Phase> extends NodeHeader {
  readonly kind: "SemicolonClassElement";
  readonly tsonic: P["SemicolonClassElement"];
}

export interface ClassStaticBlockDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "ClassStaticBlockDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly body: Block<P>;
  readonly tsonic: P["ClassStaticBlockDeclaration"];
}

export interface OmittedExpression<P extends Phase> extends NodeHeader {
  readonly kind: "OmittedExpression";
  readonly tsonic: P["OmittedExpression"];
}

export type ExcludedExpressionForm = "JsxElement" | "JsxSelfClosingElement" | "JsxFragment" | "DynamicImport";

export interface ExcludedExpression<P extends Phase> extends NodeHeader {
  readonly kind: "ExcludedExpression";
  readonly form: ExcludedExpressionForm;
  readonly tsonic: P["ExcludedExpression"];
}

export interface KeywordExpression<P extends Phase, K extends KeywordExpressionSyntaxKind = KeywordExpressionSyntaxKind> extends NodeHeader {
  readonly kind: K;
  readonly tsonic: P["KeywordExpression"];
}

export interface StringLiteral<P extends Phase> extends NodeHeader {
  readonly kind: "StringLiteral";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly tsonic: P["StringLiteral"];
}

export interface NumericLiteral<P extends Phase> extends NodeHeader {
  readonly kind: "NumericLiteral";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly tsonic: P["NumericLiteral"];
}

export interface BigIntLiteral<P extends Phase> extends NodeHeader {
  readonly kind: "BigIntLiteral";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly tsonic: P["BigIntLiteral"];
}

export interface RegularExpressionLiteral<P extends Phase> extends NodeHeader {
  readonly kind: "RegularExpressionLiteral";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly tsonic: P["RegularExpressionLiteral"];
}

export interface NoSubstitutionTemplateLiteral<P extends Phase> extends NodeHeader {
  readonly kind: "NoSubstitutionTemplateLiteral";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly rawText: string;
  readonly templateFlags: readonly TokenFlag[];
  readonly tsonic: P["NoSubstitutionTemplateLiteral"];
}

export interface BinaryExpression<P extends Phase> extends NodeHeader {
  readonly kind: "BinaryExpression";
  readonly modifiers: ModifierList<P> | null;
  readonly left: Expression<P>;
  readonly type: TypeNode<P> | null;
  readonly operatorToken: BinaryOperatorToken<P>;
  readonly right: Expression<P>;
  readonly tsonic: P["BinaryExpression"];
}

export type PrefixUnaryOperatorToken = "PlusToken" | "MinusToken" | "TildeToken" | "ExclamationToken" | "PlusPlusToken" | "MinusMinusToken";

export interface PrefixUnaryExpression<P extends Phase> extends NodeHeader {
  readonly kind: "PrefixUnaryExpression";
  readonly operator: PrefixUnaryOperatorToken;
  readonly operand: Expression<P>;
  readonly tsonic: P["PrefixUnaryExpression"];
}

export interface PostfixUnaryExpression<P extends Phase> extends NodeHeader {
  readonly kind: "PostfixUnaryExpression";
  readonly operand: Expression<P>;
  readonly operator: "PlusPlusToken" | "MinusMinusToken";
  readonly tsonic: P["PostfixUnaryExpression"];
}

export interface YieldExpression<P extends Phase> extends NodeHeader {
  readonly kind: "YieldExpression";
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly expression: Expression<P> | null;
  readonly tsonic: P["YieldExpression"];
}

export interface ArrowFunction<P extends Phase> extends NodeHeader {
  readonly kind: "ArrowFunction";
  readonly modifiers: ModifierList<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly body: BlockOrExpression<P> | null;
  readonly equalsGreaterThanToken: EqualsGreaterThanToken<P>;
  readonly tsonic: P["ArrowFunction"];
}

export interface FunctionExpression<P extends Phase> extends NodeHeader {
  readonly kind: "FunctionExpression";
  readonly modifiers: ModifierList<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly body: BlockOrExpression<P> | null;
  readonly name: Identifier<P> | null;
  readonly tsonic: P["FunctionExpression"];
}

export interface AsExpression<P extends Phase> extends NodeHeader {
  readonly kind: "AsExpression";
  readonly expression: Expression<P>;
  readonly type: TypeNode<P>;
  readonly tsonic: P["AsExpression"];
}

export interface SatisfiesExpression<P extends Phase> extends NodeHeader {
  readonly kind: "SatisfiesExpression";
  readonly expression: Expression<P>;
  readonly type: TypeNode<P>;
  readonly tsonic: P["SatisfiesExpression"];
}

export interface ConditionalExpression<P extends Phase> extends NodeHeader {
  readonly kind: "ConditionalExpression";
  readonly condition: Expression<P>;
  readonly questionToken: QuestionToken<P>;
  readonly whenTrue: Expression<P>;
  readonly colonToken: ColonToken<P>;
  readonly whenFalse: Expression<P>;
  readonly tsonic: P["ConditionalExpression"];
}

export interface PropertyAccessExpression<P extends Phase> extends NodeHeader {
  readonly kind: "PropertyAccessExpression";
  readonly expression: Expression<P>;
  readonly questionDotToken: QuestionDotToken<P> | null;
  readonly name: MemberName<P>;
  readonly tsonic: P["PropertyAccessExpression"];
}

export interface ElementAccessExpression<P extends Phase> extends NodeHeader {
  readonly kind: "ElementAccessExpression";
  readonly expression: Expression<P>;
  readonly questionDotToken: QuestionDotToken<P> | null;
  readonly argumentExpression: Expression<P>;
  readonly tsonic: P["ElementAccessExpression"];
}

export type SyntaxCallArguments<P extends Phase> = P["CallArguments"];

export interface CallExpression<P extends Phase> extends NodeHeader {
  readonly kind: "CallExpression";
  readonly expression: Expression<P>;
  readonly questionDotToken: QuestionDotToken<P> | null;
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly arguments: SyntaxCallArguments<P>;
  readonly tsonic: P["CallExpression"];
}

export interface NewExpression<P extends Phase> extends NodeHeader {
  readonly kind: "NewExpression";
  readonly expression: Expression<P>;
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly arguments: NodeList<Expression<P>> | null;
  readonly tsonic: P["NewExpression"];
}

export interface MetaProperty<P extends Phase> extends NodeHeader {
  readonly kind: "MetaProperty";
  readonly keywordToken: "ImportKeyword" | "NewKeyword";
  readonly name: Identifier<P>;
  readonly tsonic: P["MetaProperty"];
}

export interface NonNullExpression<P extends Phase> extends NodeHeader {
  readonly kind: "NonNullExpression";
  readonly expression: Expression<P>;
  readonly tsonic: P["NonNullExpression"];
}

export interface SpreadElement<P extends Phase> extends NodeHeader {
  readonly kind: "SpreadElement";
  readonly expression: Expression<P>;
  readonly tsonic: P["SpreadElement"];
}

export interface TemplateExpression<P extends Phase> extends NodeHeader {
  readonly kind: "TemplateExpression";
  readonly head: TemplateHead<P>;
  readonly templateSpans: NodeList<TemplateSpan<P>>;
  readonly tsonic: P["TemplateExpression"];
}

export interface TemplateSpan<P extends Phase> extends NodeHeader {
  readonly kind: "TemplateSpan";
  readonly expression: Expression<P>;
  readonly literal: TemplateMiddleOrTail<P>;
  readonly tsonic: P["TemplateSpan"];
}

export interface TaggedTemplateExpression<P extends Phase> extends NodeHeader {
  readonly kind: "TaggedTemplateExpression";
  readonly tag: Expression<P>;
  readonly questionDotToken: QuestionDotToken<P> | null;
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly template: TemplateLiteral<P>;
  readonly tsonic: P["TaggedTemplateExpression"];
}

export interface ParenthesizedExpression<P extends Phase> extends NodeHeader {
  readonly kind: "ParenthesizedExpression";
  readonly expression: Expression<P>;
  readonly tsonic: P["ParenthesizedExpression"];
}

export interface ArrayLiteralExpression<P extends Phase> extends NodeHeader {
  readonly kind: "ArrayLiteralExpression";
  readonly elements: NodeList<Expression<P>>;
  readonly multiLine: boolean;
  readonly tsonic: P["ArrayLiteralExpression"];
}

export interface ObjectLiteralExpression<P extends Phase> extends NodeHeader {
  readonly kind: "ObjectLiteralExpression";
  readonly properties: NodeList<ObjectLiteralElementLike<P>>;
  readonly multiLine: boolean;
  readonly tsonic: P["ObjectLiteralExpression"];
}

export interface SpreadAssignment<P extends Phase> extends NodeHeader {
  readonly kind: "SpreadAssignment";
  readonly expression: Expression<P>;
  readonly tsonic: P["SpreadAssignment"];
}

export interface PropertyAssignment<P extends Phase> extends NodeHeader {
  readonly kind: "PropertyAssignment";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly type: TypeNode<P> | null;
  readonly initializer: Expression<P>;
  readonly tsonic: P["PropertyAssignment"];
}

export interface ShorthandPropertyAssignment<P extends Phase> extends NodeHeader {
  readonly kind: "ShorthandPropertyAssignment";
  readonly modifiers: ModifierList<P> | null;
  readonly name: PropertyName<P>;
  readonly postfixToken: QuestionToken<P> | ExclamationToken<P> | null;
  readonly type: TypeNode<P> | null;
  readonly equalsToken: EqualsToken<P> | null;
  readonly objectAssignmentInitializer: Expression<P> | null;
  readonly tsonic: P["ShorthandPropertyAssignment"];
}

export interface DeleteExpression<P extends Phase> extends NodeHeader {
  readonly kind: "DeleteExpression";
  readonly expression: Expression<P>;
  readonly tsonic: P["DeleteExpression"];
}

export interface TypeOfExpression<P extends Phase> extends NodeHeader {
  readonly kind: "TypeOfExpression";
  readonly expression: Expression<P>;
  readonly tsonic: P["TypeOfExpression"];
}

export interface VoidExpression<P extends Phase> extends NodeHeader {
  readonly kind: "VoidExpression";
  readonly expression: Expression<P>;
  readonly tsonic: P["VoidExpression"];
}

export interface AwaitExpression<P extends Phase> extends NodeHeader {
  readonly kind: "AwaitExpression";
  readonly expression: Expression<P>;
  readonly tsonic: P["AwaitExpression"];
}

export interface TypeAssertion<P extends Phase> extends NodeHeader {
  readonly kind: "TypeAssertionExpression";
  readonly type: TypeNode<P>;
  readonly expression: Expression<P>;
  readonly tsonic: P["TypeAssertion"];
}

export interface KeywordTypeNode<P extends Phase, K extends KeywordTypeSyntaxKind = KeywordTypeSyntaxKind> extends NodeHeader {
  readonly kind: K;
  readonly tsonic: P["KeywordTypeNode"];
}

export interface UnionTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "UnionType";
  readonly types: NodeList<TypeNode<P>>;
  readonly tsonic: P["UnionTypeNode"];
}

export interface IntersectionTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "IntersectionType";
  readonly types: NodeList<TypeNode<P>>;
  readonly tsonic: P["IntersectionTypeNode"];
}

export interface ConditionalTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "ConditionalType";
  readonly checkType: TypeNode<P>;
  readonly extendsType: TypeNode<P>;
  readonly trueType: TypeNode<P>;
  readonly falseType: TypeNode<P>;
  readonly tsonic: P["ConditionalTypeNode"];
}

export interface TypeOperatorNode<P extends Phase> extends NodeHeader {
  readonly kind: "TypeOperator";
  readonly operator: "KeyOfKeyword" | "ReadonlyKeyword" | "UniqueKeyword";
  readonly type: TypeNode<P>;
  readonly tsonic: P["TypeOperatorNode"];
}

export interface InferTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "InferType";
  readonly typeParameter: TypeParameterDeclaration<P>;
  readonly tsonic: P["InferTypeNode"];
}

export interface ArrayTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "ArrayType";
  readonly elementType: TypeNode<P>;
  readonly tsonic: P["ArrayTypeNode"];
}

export interface IndexedAccessTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "IndexedAccessType";
  readonly objectType: TypeNode<P>;
  readonly indexType: TypeNode<P>;
  readonly tsonic: P["IndexedAccessTypeNode"];
}

export interface TypeReferenceNode<P extends Phase> extends NodeHeader {
  readonly kind: "TypeReference";
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly typeName: EntityName<P>;
  readonly tsonic: P["TypeReferenceNode"];
}

export interface ExpressionWithTypeArguments<P extends Phase> extends NodeHeader {
  readonly kind: "ExpressionWithTypeArguments";
  readonly expression: Expression<P>;
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly tsonic: P["ExpressionWithTypeArguments"];
}

export interface LiteralTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "LiteralType";
  readonly literal: LiteralTypeChild<P>;
  readonly tsonic: P["LiteralTypeNode"];
}

export type LiteralTypeChild<P extends Phase> =
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | KeywordExpression<P, "TrueKeyword" | "FalseKeyword" | "NullKeyword">
  | PrefixUnaryExpression<P>;

export interface ThisTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "ThisType";
  readonly tsonic: P["ThisTypeNode"];
}

export interface TypePredicateNode<P extends Phase> extends NodeHeader {
  readonly kind: "TypePredicate";
  readonly assertsModifier: AssertsKeyword<P> | null;
  readonly parameterName: TypePredicateParameterName<P>;
  readonly type: TypeNode<P> | null;
  readonly tsonic: P["TypePredicateNode"];
}

export interface ImportAttribute<P extends Phase> extends NodeHeader {
  readonly kind: "ImportAttribute";
  readonly name: ImportAttributeName<P>;
  readonly value: Expression<P>;
  readonly tsonic: P["ImportAttribute"];
}

export interface ImportAttributes<P extends Phase> extends NodeHeader {
  readonly kind: "ImportAttributes";
  readonly token: "WithKeyword" | "AssertKeyword";
  readonly attributes: NodeList<ImportAttribute<P>>;
  readonly multiLine: boolean;
  readonly tsonic: P["ImportAttributes"];
}

export interface TypeQueryNode<P extends Phase> extends NodeHeader {
  readonly kind: "TypeQuery";
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly exprName: EntityName<P>;
  readonly tsonic: P["TypeQueryNode"];
}

export interface MappedTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "MappedType";
  readonly readonlyToken: ReadonlyKeyword<P> | PlusToken<P> | MinusToken<P> | null;
  readonly typeParameter: TypeParameterDeclaration<P>;
  readonly nameType: TypeNode<P> | null;
  readonly questionToken: QuestionToken<P> | PlusToken<P> | MinusToken<P> | null;
  readonly type: TypeNode<P> | null;
  readonly members: NodeList<TypeElement<P>> | null;
  readonly tsonic: P["MappedTypeNode"];
}

export interface TypeLiteralNode<P extends Phase> extends NodeHeader {
  readonly kind: "TypeLiteral";
  readonly members: NodeList<TypeElement<P>>;
  readonly tsonic: P["TypeLiteralNode"];
}

export interface TupleTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "TupleType";
  readonly elements: NodeList<TypeNode<P>>;
  readonly tsonic: P["TupleTypeNode"];
}

export interface NamedTupleMember<P extends Phase> extends NodeHeader {
  readonly kind: "NamedTupleMember";
  readonly dotDotDotToken: DotDotDotToken<P> | null;
  readonly name: Identifier<P>;
  readonly questionToken: QuestionToken<P> | null;
  readonly type: TypeNode<P>;
  readonly tsonic: P["NamedTupleMember"];
}

export interface OptionalTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "OptionalType";
  readonly type: TypeNode<P>;
  readonly tsonic: P["OptionalTypeNode"];
}

export interface RestTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "RestType";
  readonly type: TypeNode<P>;
  readonly tsonic: P["RestTypeNode"];
}

export interface ParenthesizedTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "ParenthesizedType";
  readonly type: TypeNode<P>;
  readonly tsonic: P["ParenthesizedTypeNode"];
}

export interface FunctionTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "FunctionType";
  readonly modifiers: ModifierList<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly tsonic: P["FunctionTypeNode"];
}

export interface ConstructorTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "ConstructorType";
  readonly modifiers: ModifierList<P> | null;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly tsonic: P["ConstructorTypeNode"];
}

export interface TemplateHead<P extends Phase> extends NodeHeader {
  readonly kind: "TemplateHead";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly rawText: string;
  readonly templateFlags: readonly TokenFlag[];
  readonly tsonic: P["TemplateHead"];
}

export interface TemplateMiddle<P extends Phase> extends NodeHeader {
  readonly kind: "TemplateMiddle";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly rawText: string;
  readonly templateFlags: readonly TokenFlag[];
  readonly tsonic: P["TemplateMiddle"];
}

export interface TemplateTail<P extends Phase> extends NodeHeader {
  readonly kind: "TemplateTail";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly rawText: string;
  readonly templateFlags: readonly TokenFlag[];
  readonly tsonic: P["TemplateTail"];
}

export interface TemplateLiteralTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "TemplateLiteralType";
  readonly head: TemplateHead<P>;
  readonly templateSpans: NodeList<TemplateLiteralTypeSpan<P>>;
  readonly tsonic: P["TemplateLiteralTypeNode"];
}

export interface TemplateLiteralTypeSpan<P extends Phase> extends NodeHeader {
  readonly kind: "TemplateLiteralTypeSpan";
  readonly type: TypeNode<P>;
  readonly literal: TemplateMiddleOrTail<P>;
  readonly tsonic: P["TemplateLiteralTypeSpan"];
}

export interface PartiallyEmittedExpression<P extends Phase> extends NodeHeader {
  readonly kind: "PartiallyEmittedExpression";
  readonly expression: Expression<P>;
  readonly tsonic: P["PartiallyEmittedExpression"];
}

export interface JsxElement<P extends Phase> extends NodeHeader {
  readonly kind: "JsxElement";
  readonly openingElement: JsxOpeningElement<P>;
  readonly children: NodeList<JsxChild<P>>;
  readonly closingElement: JsxClosingElement<P>;
  readonly tsonic: P["JsxElement"];
}

export interface JsxAttributes<P extends Phase> extends NodeHeader {
  readonly kind: "JsxAttributes";
  readonly properties: NodeList<JsxAttributeLike<P>>;
  readonly tsonic: P["JsxAttributes"];
}

export interface JsxNamespacedName<P extends Phase> extends NodeHeader {
  readonly kind: "JsxNamespacedName";
  readonly namespace: Identifier<P>;
  readonly name: Identifier<P>;
  readonly tsonic: P["JsxNamespacedName"];
}

export interface JsxOpeningElement<P extends Phase> extends NodeHeader {
  readonly kind: "JsxOpeningElement";
  readonly tagName: JsxTagNameExpression<P>;
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly attributes: JsxAttributes<P>;
  readonly tsonic: P["JsxOpeningElement"];
}

export interface JsxSelfClosingElement<P extends Phase> extends NodeHeader {
  readonly kind: "JsxSelfClosingElement";
  readonly tagName: JsxTagNameExpression<P>;
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly attributes: JsxAttributes<P>;
  readonly tsonic: P["JsxSelfClosingElement"];
}

export interface JsxFragment<P extends Phase> extends NodeHeader {
  readonly kind: "JsxFragment";
  readonly openingFragment: JsxOpeningFragment<P>;
  readonly children: NodeList<JsxChild<P>>;
  readonly closingFragment: JsxClosingFragment<P>;
  readonly tsonic: P["JsxFragment"];
}

export interface JsxOpeningFragment<P extends Phase> extends NodeHeader {
  readonly kind: "JsxOpeningFragment";
  readonly tsonic: P["JsxOpeningFragment"];
}

export interface JsxClosingFragment<P extends Phase> extends NodeHeader {
  readonly kind: "JsxClosingFragment";
  readonly tsonic: P["JsxClosingFragment"];
}

export interface JsxAttribute<P extends Phase> extends NodeHeader {
  readonly kind: "JsxAttribute";
  readonly name: JsxAttributeName<P>;
  readonly initializer: JsxAttributeValue<P> | null;
  readonly tsonic: P["JsxAttribute"];
}

export interface JsxSpreadAttribute<P extends Phase> extends NodeHeader {
  readonly kind: "JsxSpreadAttribute";
  readonly expression: Expression<P>;
  readonly tsonic: P["JsxSpreadAttribute"];
}

export interface JsxClosingElement<P extends Phase> extends NodeHeader {
  readonly kind: "JsxClosingElement";
  readonly tagName: JsxTagNameExpression<P>;
  readonly tsonic: P["JsxClosingElement"];
}

export interface JsxExpression<P extends Phase> extends NodeHeader {
  readonly kind: "JsxExpression";
  readonly dotDotDotToken: DotDotDotToken<P> | null;
  readonly expression: Expression<P> | null;
  readonly tsonic: P["JsxExpression"];
}

export interface JsxText<P extends Phase> extends NodeHeader {
  readonly kind: "JsxText";
  readonly text: string;
  readonly tokenFlags: readonly TokenFlag[];
  readonly containsOnlyTriviaWhiteSpaces: boolean;
  readonly tsonic: P["JsxText"];
}

export interface SyntaxList<P extends Phase> extends NodeHeader {
  readonly kind: "SyntaxList";
  readonly children: readonly (SyntaxNode<P>)[];
  readonly tsonic: P["SyntaxList"];
}

export interface JSDoc<P extends Phase> extends NodeHeader {
  readonly kind: "JSDoc";
  readonly comment: NodeList<JSDocComment<P>>;
  readonly tags: NodeList<JSDocTag<P>> | null;
  readonly tsonic: P["JSDoc"];
}

export interface JSDocTypeExpression<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocTypeExpression";
  readonly type: TypeNode<P>;
  readonly tsonic: P["JSDocTypeExpression"];
}

export interface JSDocNonNullableType<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocNonNullableType";
  readonly type: TypeNode<P>;
  readonly tsonic: P["JSDocNonNullableType"];
}

export interface JSDocNullableType<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocNullableType";
  readonly type: TypeNode<P>;
  readonly tsonic: P["JSDocNullableType"];
}

export interface JSDocAllType<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocAllType";
  readonly tsonic: P["JSDocAllType"];
}

export interface JSDocVariadicType<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocVariadicType";
  readonly type: TypeNode<P>;
  readonly tsonic: P["JSDocVariadicType"];
}

export interface JSDocOptionalType<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocOptionalType";
  readonly type: TypeNode<P>;
  readonly tsonic: P["JSDocOptionalType"];
}

export interface JSDocTypeTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocTypeTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: SyntaxNode<P>;
  readonly tsonic: P["JSDocTypeTag"];
}

export interface JSDocUnknownTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocUnknownTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly tsonic: P["JSDocUnknownTag"];
}

export interface JSDocTemplateTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocTemplateTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly constraint: SyntaxNode<P>;
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>>;
  readonly tsonic: P["JSDocTemplateTag"];
}

export interface JSDocReturnTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocReturnTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: TypeNode<P> | null;
  readonly tsonic: P["JSDocReturnTag"];
}

export interface JSDocPublicTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocPublicTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly tsonic: P["JSDocPublicTag"];
}

export interface JSDocPrivateTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocPrivateTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly tsonic: P["JSDocPrivateTag"];
}

export interface JSDocProtectedTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocProtectedTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly tsonic: P["JSDocProtectedTag"];
}

export interface JSDocReadonlyTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocReadonlyTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly tsonic: P["JSDocReadonlyTag"];
}

export interface JSDocOverrideTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocOverrideTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly tsonic: P["JSDocOverrideTag"];
}

export interface JSDocDeprecatedTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocDeprecatedTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly tsonic: P["JSDocDeprecatedTag"];
}

export interface JSDocSeeTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocSeeTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly nameExpression: TypeNode<P>;
  readonly tsonic: P["JSDocSeeTag"];
}

export interface JSDocImplementsTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocImplementsTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly className: ExpressionWithTypeArguments<P>;
  readonly tsonic: P["JSDocImplementsTag"];
}

export interface JSDocAugmentsTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocAugmentsTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly className: ExpressionWithTypeArguments<P>;
  readonly tsonic: P["JSDocAugmentsTag"];
}

export interface JSDocSatisfiesTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocSatisfiesTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: TypeNode<P>;
  readonly tsonic: P["JSDocSatisfiesTag"];
}

export interface JSDocThrowsTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocThrowsTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: TypeNode<P> | null;
  readonly tsonic: P["JSDocThrowsTag"];
}

export interface JSDocThisTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocThisTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: TypeNode<P>;
  readonly tsonic: P["JSDocThisTag"];
}

export interface JSDocImportTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocImportTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly importClause: ImportClause<P> | null;
  readonly moduleSpecifier: Expression<P>;
  readonly attributes: ImportAttributes<P> | null;
  readonly tsonic: P["JSDocImportTag"];
}

export interface JSDocCallbackTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocCallbackTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: TypeNode<P>;
  readonly name: JSDocFullName<P> | null;
  readonly tsonic: P["JSDocCallbackTag"];
}

export interface JSDocOverloadTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocOverloadTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: TypeNode<P>;
  readonly tsonic: P["JSDocOverloadTag"];
}

export interface JSDocTypedefTag<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocTypedefTag";
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly typeExpression: SyntaxNode<P> | null;
  readonly name: JSDocFullName<P> | null;
  readonly tsonic: P["JSDocTypedefTag"];
}

export interface JSDocSignature<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocSignature";
  readonly typeParameters: NodeList<TypeParameterDeclaration<P>> | null;
  readonly parameters: NodeList<ParameterDeclaration<P>>;
  readonly type: TypeNode<P> | null;
  readonly fullSignature: TypeNode<P> | null;
  readonly tsonic: P["JSDocSignature"];
}

export interface JSDocNameReference<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocNameReference";
  readonly name: EntityName<P>;
  readonly tsonic: P["JSDocNameReference"];
}

export interface SourceFileFields<P extends Phase> extends NodeHeader {
  readonly endOfFileToken: EndOfFile<P>;
  readonly languageVariant: "Standard" | "JSX";
  readonly scriptKind: "Unknown" | "JS" | "JSX" | "TS" | "TSX" | "External" | "JSON" | "Deferred";
  readonly commentDirectives: readonly CommentDirective[];
  readonly pragmas: readonly Pragma[];
  readonly checkJsDirective: CheckJsDirective | null;
}

export interface SourceFileHeader<P extends Phase> extends SourceFileFields<P> {
  readonly kind: "SourceFile";
  readonly tsonic: P["SourceFile"];
}

export interface SourceFile<P extends Phase> extends SourceFileHeader<P> {
  readonly statements: NodeList<Statement<P>>;
}

export interface CommentDirective {
  readonly loc: TextRange;
  readonly kind: "Unknown" | "ExpectError" | "Ignore";
}

export interface CommentRange extends TextRange {
  readonly kind: "SingleLineCommentTrivia" | "MultiLineCommentTrivia";
  readonly hasTrailingNewLine: boolean;
}

export interface PragmaArgument extends TextRange {
  readonly name: string;
  readonly value: string;
}

export interface PragmaArgumentEntry {
  readonly name: string;
  readonly value: PragmaArgument;
}

export type PragmaArguments = readonly PragmaArgumentEntry[];
export type OrderPragmaArguments = (value: PragmaArguments) => PragmaArguments;

export interface Pragma extends CommentRange {
  readonly name: string;
  readonly args: PragmaArguments;
}

export interface CheckJsDirective {
  readonly enabled: boolean;
  readonly range: CommentRange;
}

export interface ModuleDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "ModuleDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly asteriskToken: AsteriskToken<P> | null;
  readonly body: NodeBody<P> | null;
  readonly keyword: "ModuleKeyword" | "NamespaceKeyword" | "GlobalKeyword";
  readonly name: ModuleName<P>;
  readonly tsonic: P["ModuleDeclaration"];
}

export interface ImportEqualsDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "ImportEqualsDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly isTypeOnly: boolean;
  readonly name: Identifier<P>;
  readonly moduleReference: ModuleReference<P>;
  readonly tsonic: P["ImportEqualsDeclaration"];
}

export interface ExportDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "ExportDeclaration";
  readonly modifiers: ModifierList<P> | null;
  readonly isTypeOnly: boolean;
  readonly exportClause: NamedExportBindings<P> | null;
  readonly moduleSpecifier: Expression<P> | null;
  readonly attributes: ImportAttributes<P> | null;
  readonly tsonic: P["ExportDeclaration"];
}

export interface ImportTypeNode<P extends Phase> extends NodeHeader {
  readonly kind: "ImportType";
  readonly typeArguments: NodeList<TypeNode<P>> | null;
  readonly isTypeOf: boolean;
  readonly argument: TypeNode<P>;
  readonly attributes: ImportAttributes<P> | null;
  readonly qualifier: EntityName<P> | null;
  readonly tsonic: P["ImportTypeNode"];
}

export interface ImportClause<P extends Phase> extends NodeHeader {
  readonly kind: "ImportClause";
  readonly phaseModifier: ImportPhaseModifierSyntaxKind | null;
  readonly name: Identifier<P> | null;
  readonly namedBindings: NamedImportBindings<P> | null;
  readonly tsonic: P["ImportClause"];
}

export interface ImportSpecifier<P extends Phase> extends NodeHeader {
  readonly kind: "ImportSpecifier";
  readonly isTypeOnly: boolean;
  readonly propertyName: ModuleExportName<P> | null;
  readonly name: Identifier<P>;
  readonly tsonic: P["ImportSpecifier"];
}

export interface JSDocText<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocText";
  readonly text: readonly (string)[];
  readonly tsonic: P["JSDocText"];
}

export interface JSDocLink<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocLink";
  readonly text: readonly (string)[];
  readonly name: EntityName<P> | null;
  readonly tsonic: P["JSDocLink"];
}

export interface JSDocLinkPlain<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocLinkPlain";
  readonly text: readonly (string)[];
  readonly name: EntityName<P> | null;
  readonly tsonic: P["JSDocLinkPlain"];
}

export interface JSDocLinkCode<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocLinkCode";
  readonly text: readonly (string)[];
  readonly name: EntityName<P> | null;
  readonly tsonic: P["JSDocLinkCode"];
}

export interface TypeParameterDeclaration<P extends Phase> extends NodeHeader {
  readonly kind: "TypeParameter";
  readonly modifiers: ModifierList<P> | null;
  readonly name: Identifier<P>;
  readonly constraint: TypeNode<P> | null;
  readonly expression: Expression<P> | null;
  readonly defaultType: TypeNode<P> | null;
  readonly tsonic: P["TypeParameterDeclaration"];
}

export interface SyntheticReferenceExpression<P extends Phase> extends NodeHeader {
  readonly kind: "SyntheticReferenceExpression";
  readonly expression: Expression<P>;
  readonly thisArg: Expression<P>;
  readonly tsonic: P["SyntheticReferenceExpression"];
}

export interface JSDocTypeLiteral<P extends Phase> extends NodeHeader {
  readonly kind: "JSDocTypeLiteral";
  readonly jsDocPropertyTags: readonly (JSDocTag<P>)[] | null;
  readonly isArrayType: boolean;
  readonly tsonic: P["JSDocTypeLiteral"];
}

export interface JSDocParameterOrPropertyTag<P extends Phase, K extends "JSDocParameterTag" | "JSDocPropertyTag" = "JSDocParameterTag" | "JSDocPropertyTag"> extends NodeHeader {
  readonly kind: K;
  readonly tagName: Identifier<P>;
  readonly comment: NodeList<JSDocComment<P>> | null;
  readonly name: EntityName<P>;
  readonly isBracketed: boolean;
  readonly typeExpression: TypeNode<P> | null;
  readonly isNameFirst: boolean;
  readonly tsonic: P["JSDocParameterOrPropertyTag"];
}

export type Expression<P extends Phase> =
  | ExcludedExpression<P>
  | Identifier<P>
  | PrivateIdentifier<P>
  | ClassExpression<P>
  | OmittedExpression<P>
  | KeywordExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | BinaryExpression<P>
  | PrefixUnaryExpression<P>
  | PostfixUnaryExpression<P>
  | YieldExpression<P>
  | ArrowFunction<P>
  | FunctionExpression<P>
  | AsExpression<P>
  | SatisfiesExpression<P>
  | ConditionalExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | SpreadElement<P>
  | TemplateExpression<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | DeleteExpression<P>
  | TypeOfExpression<P>
  | VoidExpression<P>
  | AwaitExpression<P>
  | TypeAssertion<P>
  | ExpressionWithTypeArguments<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxNamespacedName<P>
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>
  | JsxOpeningFragment<P>
  | JsxClosingFragment<P>
  | JsxExpression<P>
  | JsxText<P>
  | SyntheticReferenceExpression<P>;

export type NonFunctionStatement<P extends Phase> =
  | EmptyStatement<P>
  | IfStatement<P>
  | DoStatement<P>
  | WhileStatement<P>
  | ForStatement<P>
  | ForInOrOfStatement<P>
  | BreakStatement<P>
  | ContinueStatement<P>
  | ReturnStatement<P>
  | WithStatement<P>
  | SwitchStatement<P>
  | ThrowStatement<P>
  | TryStatement<P>
  | DebuggerStatement<P>
  | LabeledStatement<P>
  | ExpressionStatement<P>
  | Block<P>
  | VariableStatement<P>
  | MissingDeclaration<P>
  | ClassDeclaration<P>
  | InterfaceDeclaration<P>
  | TypeAliasDeclaration<P>
  | EnumDeclaration<P>
  | ModuleBlock<P>
  | NotEmittedStatement<P>
  | ImportDeclaration<P>
  | ExportAssignment<P>
  | NamespaceExportDeclaration<P>
  | ModuleDeclaration<P>
  | ImportEqualsDeclaration<P>
  | ExportDeclaration<P>;

export type Statement<P extends Phase> = NonFunctionStatement<P> | FunctionDeclaration<P>;

export type TypeNode<P extends Phase> =
  | KeywordTypeNode<P>
  | UnionTypeNode<P>
  | IntersectionTypeNode<P>
  | ConditionalTypeNode<P>
  | TypeOperatorNode<P>
  | InferTypeNode<P>
  | ArrayTypeNode<P>
  | IndexedAccessTypeNode<P>
  | TypeReferenceNode<P>
  | LiteralTypeNode<P>
  | ThisTypeNode<P>
  | TypePredicateNode<P>
  | TypeQueryNode<P>
  | MappedTypeNode<P>
  | TypeLiteralNode<P>
  | TupleTypeNode<P>
  | NamedTupleMember<P>
  | OptionalTypeNode<P>
  | RestTypeNode<P>
  | ParenthesizedTypeNode<P>
  | FunctionTypeNode<P>
  | ConstructorTypeNode<P>
  | TemplateLiteralTypeNode<P>
  | TemplateLiteralTypeSpan<P>
  | JSDocTypeExpression<P>
  | JSDocNonNullableType<P>
  | JSDocNullableType<P>
  | JSDocAllType<P>
  | JSDocVariadicType<P>
  | JSDocOptionalType<P>
  | JSDocSignature<P>
  | JSDocNameReference<P>
  | ImportTypeNode<P>
  | JSDocTypeLiteral<P>;

export type BlockOrExpression<P extends Phase> =
  | ExcludedExpression<P>
  | Block<P>
  | Identifier<P>
  | PrivateIdentifier<P>
  | ClassExpression<P>
  | OmittedExpression<P>
  | KeywordExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | BinaryExpression<P>
  | PrefixUnaryExpression<P>
  | PostfixUnaryExpression<P>
  | YieldExpression<P>
  | ArrowFunction<P>
  | FunctionExpression<P>
  | AsExpression<P>
  | SatisfiesExpression<P>
  | ConditionalExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | SpreadElement<P>
  | TemplateExpression<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | DeleteExpression<P>
  | TypeOfExpression<P>
  | VoidExpression<P>
  | AwaitExpression<P>
  | TypeAssertion<P>
  | ExpressionWithTypeArguments<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxNamespacedName<P>
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>
  | JsxOpeningFragment<P>
  | JsxClosingFragment<P>
  | JsxExpression<P>
  | JsxText<P>
  | SyntheticReferenceExpression<P>;

export type NodeBody<P extends Phase> =
  | ExcludedExpression<P>
  | Block<P>
  | Identifier<P>
  | PrivateIdentifier<P>
  | ClassExpression<P>
  | OmittedExpression<P>
  | KeywordExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | BinaryExpression<P>
  | PrefixUnaryExpression<P>
  | PostfixUnaryExpression<P>
  | YieldExpression<P>
  | ArrowFunction<P>
  | FunctionExpression<P>
  | AsExpression<P>
  | SatisfiesExpression<P>
  | ConditionalExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | SpreadElement<P>
  | TemplateExpression<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | DeleteExpression<P>
  | TypeOfExpression<P>
  | VoidExpression<P>
  | AwaitExpression<P>
  | TypeAssertion<P>
  | ExpressionWithTypeArguments<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxNamespacedName<P>
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>
  | JsxOpeningFragment<P>
  | JsxClosingFragment<P>
  | JsxExpression<P>
  | JsxText<P>
  | SyntheticReferenceExpression<P>
  | ModuleBlock<P>
  | ModuleDeclaration<P>;

export type AccessExpression<P extends Phase> =
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>;

export type DeclarationName<P extends Phase> =
  | Identifier<P>
  | PrivateIdentifier<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | ComputedPropertyName<P>
  | BindingPattern<P>
  | ElementAccessExpression<P>;

export type ModuleName<P extends Phase> =
  | Identifier<P>
  | StringLiteral<P>;

export type ModuleExportName<P extends Phase> =
  | Identifier<P>
  | StringLiteral<P>;

export type PropertyName<P extends Phase> =
  | Identifier<P>
  | StringLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | NumericLiteral<P>
  | ComputedPropertyName<P>
  | PrivateIdentifier<P>
  | BigIntLiteral<P>;

export type ModuleBody<P extends Phase> =
  | ModuleBlock<P>
  | ModuleDeclaration<P>;

export type JSDocFullName<P extends Phase> =
  | Identifier<P>
  | ModuleDeclaration<P>;

export type ForInitializer<P extends Phase> =
  | ExcludedExpression<P>
  | Identifier<P>
  | PrivateIdentifier<P>
  | ClassExpression<P>
  | OmittedExpression<P>
  | KeywordExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | BinaryExpression<P>
  | PrefixUnaryExpression<P>
  | PostfixUnaryExpression<P>
  | YieldExpression<P>
  | ArrowFunction<P>
  | FunctionExpression<P>
  | AsExpression<P>
  | SatisfiesExpression<P>
  | ConditionalExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | SpreadElement<P>
  | TemplateExpression<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | DeleteExpression<P>
  | TypeOfExpression<P>
  | VoidExpression<P>
  | AwaitExpression<P>
  | TypeAssertion<P>
  | ExpressionWithTypeArguments<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxNamespacedName<P>
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>
  | JsxOpeningFragment<P>
  | JsxClosingFragment<P>
  | JsxExpression<P>
  | JsxText<P>
  | SyntheticReferenceExpression<P>
  | MissingDeclaration<P>
  | VariableDeclarationList<P>;

export type ModuleReference<P extends Phase> =
  | Identifier<P>
  | QualifiedName<P>
  | ExternalModuleReference<P>;

export type NamedImportBindings<P extends Phase> =
  | NamespaceImport<P>
  | NamedImports<P>;

export type NamedExportBindings<P extends Phase> =
  | NamespaceExport<P>
  | NamedExports<P>;

export type MemberName<P extends Phase> =
  | Identifier<P>
  | PrivateIdentifier<P>;

export type EntityName<P extends Phase> =
  | Identifier<P>
  | QualifiedName<P>;

export type BindingName<P extends Phase> =
  | Identifier<P>
  | BindingPattern<P>;

export type ModifierLike<P extends Phase> =
  | Token<P, "AbstractKeyword">
  | Token<P, "AccessorKeyword">
  | Token<P, "AsyncKeyword">
  | Token<P, "ConstKeyword">
  | Token<P, "DeclareKeyword">
  | Token<P, "DefaultKeyword">
  | Token<P, "ExportKeyword">
  | Token<P, "InKeyword">
  | Token<P, "PrivateKeyword">
  | Token<P, "ProtectedKeyword">
  | Token<P, "PublicKeyword">
  | Token<P, "ReadonlyKeyword">
  | Token<P, "OutKeyword">
  | Token<P, "OverrideKeyword">
  | Token<P, "StaticKeyword">
  | Decorator<P>;

export type JsxChild<P extends Phase> =
  | JsxText<P>
  | JsxExpression<P>
  | JsxElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>;

export type JsxAttributeLike<P extends Phase> =
  | JsxAttribute<P>
  | JsxSpreadAttribute<P>;

export type JsxAttributeName<P extends Phase> =
  | Identifier<P>
  | JsxNamespacedName<P>;

export type JsxAttributeValue<P extends Phase> =
  | StringLiteral<P>
  | JsxExpression<P>
  | JsxElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>;

export type JsxTagNameExpression<P extends Phase> =
  | Identifier<P>
  | KeywordExpression<P>
  | PropertyAccessExpression<P>
  | JsxNamespacedName<P>;

export type ClassLikeDeclaration<P extends Phase> =
  | ClassDeclaration<P>
  | ClassExpression<P>;

export type AccessorDeclaration<P extends Phase> =
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>;

export type LiteralLikeNode<P extends Phase> =
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | TemplateHead<P>
  | TemplateMiddle<P>
  | TemplateTail<P>
  | JsxText<P>;

export type LiteralExpression<P extends Phase> =
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>;

export type UnionOrIntersectionTypeNode<P extends Phase> =
  | UnionTypeNode<P>
  | IntersectionTypeNode<P>;

export type TemplateLiteralLikeNode<P extends Phase> =
  | TemplateHead<P>
  | TemplateMiddle<P>
  | TemplateTail<P>;

export type TemplateMiddleOrTail<P extends Phase> =
  | TemplateMiddle<P>
  | TemplateTail<P>;

export type TemplateLiteral<P extends Phase> =
  | TemplateExpression<P>
  | NoSubstitutionTemplateLiteral<P>;

export type TypePredicateParameterName<P extends Phase> =
  | Identifier<P>
  | ThisTypeNode<P>;

export type ImportAttributeName<P extends Phase> =
  | Identifier<P>
  | StringLiteral<P>;

export type LeftHandSideExpression<P extends Phase> =
  | ExcludedExpression<P>
  | Identifier<P>
  | PrivateIdentifier<P>
  | ClassExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | FunctionExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | TemplateExpression<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | ExpressionWithTypeArguments<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>;

export type JSDocComment<P extends Phase> =
  | JSDocText<P>
  | JSDocLink<P>
  | JSDocLinkCode<P>
  | JSDocLinkPlain<P>;

export type SignatureDeclaration<P extends Phase> =
  | CallSignatureDeclaration<P>
  | ConstructSignatureDeclaration<P>
  | MethodSignatureDeclaration<P>
  | IndexSignatureDeclaration<P>
  | FunctionTypeNode<P>
  | ConstructorTypeNode<P>
  | FunctionDeclaration<P>
  | MethodDeclaration<P>
  | ConstructorDeclaration<P>
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>
  | FunctionExpression<P>
  | ArrowFunction<P>;

export type StringLiteralLikeNode<P extends Phase> =
  | StringLiteral<P>
  | NoSubstitutionTemplateLiteral<P>;

export type NumericOrStringLikeLiteral<P extends Phase> =
  | StringLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | NumericLiteral<P>;

export type ObjectLiteralLikeNode<P extends Phase> =
  | ObjectLiteralExpression<P>
  | BindingPattern<P, "ObjectBindingPattern">;

export type ObjectTypeDeclaration<P extends Phase> =
  | ClassDeclaration<P>
  | ClassExpression<P>
  | InterfaceDeclaration<P>
  | TypeLiteralNode<P>;

export type JsxOpeningLikeElement<P extends Phase> =
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>;

export type NamedImportsOrExports<P extends Phase> =
  | NamedImports<P>
  | NamedExports<P>;

export type BreakOrContinueStatement<P extends Phase> =
  | BreakStatement<P>
  | ContinueStatement<P>;

export type CallLikeExpression<P extends Phase> =
  | CallExpression<P>
  | NewExpression<P>
  | TaggedTemplateExpression<P>
  | Decorator<P>
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>
  | BinaryExpression<P>;

export type FunctionLikeDeclaration<P extends Phase> =
  | FunctionDeclaration<P>
  | MethodDeclaration<P>
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>
  | ConstructorDeclaration<P>
  | FunctionExpression<P>
  | ArrowFunction<P>;

export type VariableOrParameterDeclaration<P extends Phase> =
  | VariableDeclaration<P>
  | ParameterDeclaration<P>;

export type VariableOrPropertyDeclaration<P extends Phase> =
  | VariableDeclaration<P>
  | PropertyDeclaration<P>;

export type CallOrNewExpression<P extends Phase> =
  | CallExpression<P>
  | NewExpression<P>;

export type ImportClauseOrBindingPattern<P extends Phase> =
  | ImportClause<P>
  | BindingPattern<P>;

export type AnyImportSyntax<P extends Phase> =
  | ImportDeclaration<P>
  | ImportEqualsDeclaration<P>;

export type Declaration<P extends Phase> =
  | VariableDeclaration<P>
  | ParameterDeclaration<P>
  | BindingElement<P>
  | MissingDeclaration<P>
  | FunctionDeclaration<P>
  | ClassDeclaration<P>
  | ClassExpression<P>
  | InterfaceDeclaration<P>
  | TypeAliasDeclaration<P>
  | EnumMember<P>
  | EnumDeclaration<P>
  | ImportDeclaration<P>
  | NamespaceImport<P>
  | ExportAssignment<P>
  | NamespaceExportDeclaration<P>
  | NamespaceExport<P>
  | ExportSpecifier<P>
  | CallSignatureDeclaration<P>
  | ConstructSignatureDeclaration<P>
  | ConstructorDeclaration<P>
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>
  | IndexSignatureDeclaration<P>
  | MethodSignatureDeclaration<P>
  | MethodDeclaration<P>
  | PropertySignatureDeclaration<P>
  | PropertyDeclaration<P>
  | SemicolonClassElement<P>
  | ClassStaticBlockDeclaration<P>
  | NoSubstitutionTemplateLiteral<P>
  | BinaryExpression<P>
  | ArrowFunction<P>
  | FunctionExpression<P>
  | CallExpression<P>
  | ObjectLiteralExpression<P>
  | SpreadAssignment<P>
  | PropertyAssignment<P>
  | ShorthandPropertyAssignment<P>
  | MappedTypeNode<P>
  | TypeLiteralNode<P>
  | NamedTupleMember<P>
  | FunctionTypeNode<P>
  | ConstructorTypeNode<P>
  | JsxAttributes<P>
  | JsxAttribute<P>
  | JSDocSignature<P>
  | SourceFile<P>
  | ModuleDeclaration<P>
  | ImportEqualsDeclaration<P>
  | ExportDeclaration<P>
  | ImportClause<P>
  | ImportSpecifier<P>
  | TypeParameterDeclaration<P>
  | JSDocTypeLiteral<P>;

export type ClassElement<P extends Phase> =
  | ConstructorDeclaration<P>
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>
  | IndexSignatureDeclaration<P>
  | MethodDeclaration<P>
  | PropertyDeclaration<P>
  | SemicolonClassElement<P>
  | ClassStaticBlockDeclaration<P>;

export type TypeElement<P extends Phase> =
  | NotEmittedTypeElement<P>
  | CallSignatureDeclaration<P>
  | ConstructSignatureDeclaration<P>
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>
  | IndexSignatureDeclaration<P>
  | MethodSignatureDeclaration<P>
  | PropertySignatureDeclaration<P>;

export type ObjectLiteralElement<P extends Phase> =
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>
  | MethodDeclaration<P>
  | SpreadAssignment<P>
  | PropertyAssignment<P>
  | ShorthandPropertyAssignment<P>
  | JsxSpreadAttribute<P>;

export type JSDocTag<P extends Phase> =
  | JSDocTypeTag<P>
  | JSDocUnknownTag<P>
  | JSDocTemplateTag<P>
  | JSDocReturnTag<P>
  | JSDocPublicTag<P>
  | JSDocPrivateTag<P>
  | JSDocProtectedTag<P>
  | JSDocReadonlyTag<P>
  | JSDocOverrideTag<P>
  | JSDocDeprecatedTag<P>
  | JSDocSeeTag<P>
  | JSDocImplementsTag<P>
  | JSDocAugmentsTag<P>
  | JSDocSatisfiesTag<P>
  | JSDocThrowsTag<P>
  | JSDocThisTag<P>
  | JSDocImportTag<P>
  | JSDocCallbackTag<P>
  | JSDocOverloadTag<P>
  | JSDocTypedefTag<P>
  | JSDocParameterOrPropertyTag<P>;

export type ArrayBindingElement<P extends Phase> =
  | BindingElement<P>
  | OmittedExpression<P>;

export type AssertionExpression<P extends Phase> =
  | TypeAssertion<P>
  | AsExpression<P>;

export type BooleanLiteral<P extends Phase> =
  | KeywordExpression<P, "TrueKeyword">
  | KeywordExpression<P, "FalseKeyword">;

export type ConciseBody<P extends Phase> =
  | Block<P>
  | Identifier<P>
  | PrivateIdentifier<P>
  | ClassExpression<P>
  | OmittedExpression<P>
  | KeywordExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | BinaryExpression<P>
  | PrefixUnaryExpression<P>
  | PostfixUnaryExpression<P>
  | YieldExpression<P>
  | ArrowFunction<P>
  | FunctionExpression<P>
  | AsExpression<P>
  | SatisfiesExpression<P>
  | ConditionalExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | SpreadElement<P>
  | TemplateExpression<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | DeleteExpression<P>
  | TypeOfExpression<P>
  | VoidExpression<P>
  | AwaitExpression<P>
  | TypeAssertion<P>
  | ExpressionWithTypeArguments<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxNamespacedName<P>
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>
  | JsxOpeningFragment<P>
  | JsxClosingFragment<P>
  | JsxExpression<P>
  | JsxText<P>
  | SyntheticReferenceExpression<P>;

export type DestructuringAssignment<P extends Phase> =
  | BinaryExpression<P>;

export type LiteralToken<P extends Phase> =
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | StringLiteral<P>
  | JsxText<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>;

export type Modifier<P extends Phase> =
  | Token<P, "AbstractKeyword">
  | Token<P, "AccessorKeyword">
  | Token<P, "AsyncKeyword">
  | Token<P, "ConstKeyword">
  | Token<P, "DeclareKeyword">
  | Token<P, "DefaultKeyword">
  | Token<P, "ExportKeyword">
  | Token<P, "InKeyword">
  | Token<P, "PrivateKeyword">
  | Token<P, "ProtectedKeyword">
  | Token<P, "PublicKeyword">
  | Token<P, "ReadonlyKeyword">
  | Token<P, "OutKeyword">
  | Token<P, "OverrideKeyword">
  | Token<P, "StaticKeyword">;

export type ObjectLiteralElementLike<P extends Phase> =
  | PropertyAssignment<P>
  | ShorthandPropertyAssignment<P>
  | SpreadAssignment<P>
  | MethodDeclaration<P>
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>;

export type PropertyNameLiteral<P extends Phase> =
  | Identifier<P>
  | StringLiteral<P>
  | NumericLiteral<P>;

export type PseudoLiteralToken<P extends Phase> =
  | TemplateHead<P>
  | TemplateMiddle<P>
  | TemplateTail<P>;

export type TemplateLiteralToken<P extends Phase> =
  | NoSubstitutionTemplateLiteral<P>
  | TemplateHead<P>
  | TemplateMiddle<P>
  | TemplateTail<P>;

export type ArrayDestructuringAssignment<P extends Phase> =
  | BinaryExpression<P>;

export type ObjectDestructuringAssignment<P extends Phase> =
  | BinaryExpression<P>;

export type FunctionBody<P extends Phase> =
  | Block<P>;

export type IncrementExpression<P extends Phase> =
  | Identifier<P>
  | PrivateIdentifier<P>
  | ClassExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | PrefixUnaryExpression<P>
  | PostfixUnaryExpression<P>
  | FunctionExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | TemplateExpression<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | ExpressionWithTypeArguments<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>;

export type EndOfFile<P extends Phase> = Token<P, "EndOfFile">;

export type DotToken<P extends Phase> = Token<P, "DotToken">;

export type DotDotDotToken<P extends Phase> = Token<P, "DotDotDotToken">;

export type QuestionToken<P extends Phase> = Token<P, "QuestionToken">;

export type ExclamationToken<P extends Phase> = Token<P, "ExclamationToken">;

export type ColonToken<P extends Phase> = Token<P, "ColonToken">;

export type EqualsToken<P extends Phase> = Token<P, "EqualsToken">;

export type AsteriskToken<P extends Phase> = Token<P, "AsteriskToken">;

export type EqualsGreaterThanToken<P extends Phase> = Token<P, "EqualsGreaterThanToken">;

export type PlusToken<P extends Phase> = Token<P, "PlusToken">;

export type MinusToken<P extends Phase> = Token<P, "MinusToken">;

export type QuestionDotToken<P extends Phase> = Token<P, "QuestionDotToken">;

export type AssertsKeyword<P extends Phase> = Token<P, "AssertsKeyword">;

export type AssertKeyword<P extends Phase> = Token<P, "AssertKeyword">;

export type AwaitKeyword<P extends Phase> = Token<P, "AwaitKeyword">;

export type CaseKeyword<P extends Phase> = Token<P, "CaseKeyword">;

export type AbstractKeyword<P extends Phase> = Token<P, "AbstractKeyword">;

export type AccessorKeyword<P extends Phase> = Token<P, "AccessorKeyword">;

export type AsyncKeyword<P extends Phase> = Token<P, "AsyncKeyword">;

export type ConstKeyword<P extends Phase> = Token<P, "ConstKeyword">;

export type DeclareKeyword<P extends Phase> = Token<P, "DeclareKeyword">;

export type DefaultKeyword<P extends Phase> = Token<P, "DefaultKeyword">;

export type ExportKeyword<P extends Phase> = Token<P, "ExportKeyword">;

export type InKeyword<P extends Phase> = Token<P, "InKeyword">;

export type PrivateKeyword<P extends Phase> = Token<P, "PrivateKeyword">;

export type ProtectedKeyword<P extends Phase> = Token<P, "ProtectedKeyword">;

export type PublicKeyword<P extends Phase> = Token<P, "PublicKeyword">;

export type ReadonlyKeyword<P extends Phase> = Token<P, "ReadonlyKeyword">;

export type OutKeyword<P extends Phase> = Token<P, "OutKeyword">;

export type OverrideKeyword<P extends Phase> = Token<P, "OverrideKeyword">;

export type StaticKeyword<P extends Phase> = Token<P, "StaticKeyword">;

export type BinaryOperatorToken<P extends Phase> = Token<P, BinaryOperator>;

export type AssignmentOperatorToken<P extends Phase> = Token<P, AssignmentOperator>;

export type NullLiteral<P extends Phase> = KeywordExpression<P, "NullKeyword">;

export type TrueLiteral<P extends Phase> = KeywordExpression<P, "TrueKeyword">;

export type FalseLiteral<P extends Phase> = KeywordExpression<P, "FalseKeyword">;

export type ThisExpression<P extends Phase> = KeywordExpression<P, "ThisKeyword">;

export type SuperExpression<P extends Phase> = KeywordExpression<P, "SuperKeyword">;

export type ImportExpression<P extends Phase> = KeywordExpression<P, "ImportKeyword">;

export type StatementList<P extends Phase> = NodeList<EmptyStatement<P> | IfStatement<P> | DoStatement<P> | WhileStatement<P> | ForStatement<P> | ForInOrOfStatement<P> | BreakStatement<P> | ContinueStatement<P> | ReturnStatement<P> | WithStatement<P> | SwitchStatement<P> | ThrowStatement<P> | TryStatement<P> | DebuggerStatement<P> | LabeledStatement<P> | ExpressionStatement<P> | Block<P> | VariableStatement<P> | MissingDeclaration<P> | FunctionDeclaration<P> | ClassDeclaration<P> | InterfaceDeclaration<P> | TypeAliasDeclaration<P> | EnumDeclaration<P> | ModuleBlock<P> | NotEmittedStatement<P> | ImportDeclaration<P> | ExportAssignment<P> | NamespaceExportDeclaration<P> | ModuleDeclaration<P> | ImportEqualsDeclaration<P> | ExportDeclaration<P>>;

export type CaseClausesList<P extends Phase> = NodeList<CaseOrDefaultClause<P>>;

export type VariableDeclarationNodeList<P extends Phase> = NodeList<VariableDeclaration<P>>;

export type BindingElementList<P extends Phase> = NodeList<BindingElement<P>>;

export type TypeParameterList<P extends Phase> = NodeList<TypeParameterDeclaration<P>>;

export type ParameterList<P extends Phase> = NodeList<ParameterDeclaration<P>>;

export type HeritageClauseList<P extends Phase> = NodeList<HeritageClause<P>>;

export type ClassElementList<P extends Phase> = NodeList<ConstructorDeclaration<P> | GetAccessorDeclaration<P> | SetAccessorDeclaration<P> | IndexSignatureDeclaration<P> | MethodDeclaration<P> | PropertyDeclaration<P> | SemicolonClassElement<P> | ClassStaticBlockDeclaration<P>>;

export type TypeElementList<P extends Phase> = NodeList<NotEmittedTypeElement<P> | CallSignatureDeclaration<P> | ConstructSignatureDeclaration<P> | GetAccessorDeclaration<P> | SetAccessorDeclaration<P> | IndexSignatureDeclaration<P> | MethodSignatureDeclaration<P> | PropertySignatureDeclaration<P>>;

export type ExpressionWithTypeArgumentsList<P extends Phase> = NodeList<ExpressionWithTypeArguments<P>>;

export type EnumMemberList<P extends Phase> = NodeList<EnumMember<P>>;

export type ImportSpecifierList<P extends Phase> = NodeList<ImportSpecifier<P>>;

export type ExportSpecifierList<P extends Phase> = NodeList<ExportSpecifier<P>>;

export type TypeArgumentList<P extends Phase> = NodeList<KeywordTypeNode<P> | UnionTypeNode<P> | IntersectionTypeNode<P> | ConditionalTypeNode<P> | TypeOperatorNode<P> | InferTypeNode<P> | ArrayTypeNode<P> | IndexedAccessTypeNode<P> | TypeReferenceNode<P> | LiteralTypeNode<P> | ThisTypeNode<P> | TypePredicateNode<P> | TypeQueryNode<P> | MappedTypeNode<P> | TypeLiteralNode<P> | TupleTypeNode<P> | NamedTupleMember<P> | OptionalTypeNode<P> | RestTypeNode<P> | ParenthesizedTypeNode<P> | FunctionTypeNode<P> | ConstructorTypeNode<P> | TemplateLiteralTypeNode<P> | TemplateLiteralTypeSpan<P> | JSDocTypeExpression<P> | JSDocNonNullableType<P> | JSDocNullableType<P> | JSDocAllType<P> | JSDocVariadicType<P> | JSDocOptionalType<P> | JSDocSignature<P> | JSDocNameReference<P> | ImportTypeNode<P> | JSDocTypeLiteral<P>>;

export type ArgumentList<P extends Phase> = NodeList<Expression<P>>;

export type TemplateSpanList<P extends Phase> = NodeList<TemplateSpan<P>>;

export type ElementList<P extends Phase> = NodeList<Expression<P>>;

export type PropertyDefinitionList<P extends Phase> = NodeList<GetAccessorDeclaration<P> | SetAccessorDeclaration<P> | MethodDeclaration<P> | SpreadAssignment<P> | PropertyAssignment<P> | ShorthandPropertyAssignment<P> | JsxSpreadAttribute<P>>;

export type TypeList<P extends Phase> = NodeList<KeywordTypeNode<P> | UnionTypeNode<P> | IntersectionTypeNode<P> | ConditionalTypeNode<P> | TypeOperatorNode<P> | InferTypeNode<P> | ArrayTypeNode<P> | IndexedAccessTypeNode<P> | TypeReferenceNode<P> | LiteralTypeNode<P> | ThisTypeNode<P> | TypePredicateNode<P> | TypeQueryNode<P> | MappedTypeNode<P> | TypeLiteralNode<P> | TupleTypeNode<P> | NamedTupleMember<P> | OptionalTypeNode<P> | RestTypeNode<P> | ParenthesizedTypeNode<P> | FunctionTypeNode<P> | ConstructorTypeNode<P> | TemplateLiteralTypeNode<P> | TemplateLiteralTypeSpan<P> | JSDocTypeExpression<P> | JSDocNonNullableType<P> | JSDocNullableType<P> | JSDocAllType<P> | JSDocVariadicType<P> | JSDocOptionalType<P> | JSDocSignature<P> | JSDocNameReference<P> | ImportTypeNode<P> | JSDocTypeLiteral<P>>;

export type ImportAttributeList<P extends Phase> = NodeList<ImportAttribute<P>>;

export type TemplateLiteralTypeSpanList<P extends Phase> = NodeList<TemplateLiteralTypeSpan<P>>;

export type JsxChildList<P extends Phase> = NodeList<JsxText<P> | JsxExpression<P> | JsxElement<P> | JsxSelfClosingElement<P> | JsxFragment<P>>;

export type JsxAttributeList<P extends Phase> = NodeList<JsxAttribute<P> | JsxSpreadAttribute<P>>;

export type TokenNode<P extends Phase> = Token<P>;

export type IdentifierNode<P extends Phase> = Identifier<P>;

export type PrivateIdentifierNode<P extends Phase> = PrivateIdentifier<P>;

export type QualifiedNameNode<P extends Phase> = QualifiedName<P>;

export type ComputedPropertyNameNode<P extends Phase> = ComputedPropertyName<P>;

export type DecoratorNode<P extends Phase> = Decorator<P>;

export type EmptyStatementNode<P extends Phase> = EmptyStatement<P>;

export type IfStatementNode<P extends Phase> = IfStatement<P>;

export type DoStatementNode<P extends Phase> = DoStatement<P>;

export type WhileStatementNode<P extends Phase> = WhileStatement<P>;

export type ForStatementNode<P extends Phase> = ForStatement<P>;

export type ForInOrOfStatementNode<P extends Phase> = ForInOrOfStatement<P>;

export type BreakStatementNode<P extends Phase> = BreakStatement<P>;

export type ContinueStatementNode<P extends Phase> = ContinueStatement<P>;

export type ReturnStatementNode<P extends Phase> = ReturnStatement<P>;

export type WithStatementNode<P extends Phase> = WithStatement<P>;

export type SwitchStatementNode<P extends Phase> = SwitchStatement<P>;

export type CaseBlockNode<P extends Phase> = CaseBlock<P>;

export type CaseOrDefaultClauseNode<P extends Phase> = CaseOrDefaultClause<P>;

export type ThrowStatementNode<P extends Phase> = ThrowStatement<P>;

export type TryStatementNode<P extends Phase> = TryStatement<P>;

export type CatchClauseNode<P extends Phase> = CatchClause<P>;

export type DebuggerStatementNode<P extends Phase> = DebuggerStatement<P>;

export type LabeledStatementNode<P extends Phase> = LabeledStatement<P>;

export type ExpressionStatementNode<P extends Phase> = ExpressionStatement<P>;

export type BlockNode<P extends Phase> = Block<P>;

export type VariableStatementNode<P extends Phase> = VariableStatement<P>;

export type VariableDeclarationNode<P extends Phase> = VariableDeclaration<P>;

export type VariableDeclarationListNode<P extends Phase> = VariableDeclarationList<P>;

export type BindingPatternNode<P extends Phase> = BindingPattern<P>;

export type ParameterDeclarationNode<P extends Phase> = ParameterDeclaration<P>;

export type BindingElementNode<P extends Phase> = BindingElement<P>;

export type MissingDeclarationNode<P extends Phase> = MissingDeclaration<P>;

export type FunctionDeclarationNode<P extends Phase> = FunctionDeclaration<P>;

export type ClassDeclarationNode<P extends Phase> = ClassDeclaration<P>;

export type ClassExpressionNode<P extends Phase> = ClassExpression<P>;

export type HeritageClauseNode<P extends Phase> = HeritageClause<P>;

export type InterfaceDeclarationNode<P extends Phase> = InterfaceDeclaration<P>;

export type TypeAliasDeclarationNode<P extends Phase> = TypeAliasDeclaration<P>;

export type EnumMemberNode<P extends Phase> = EnumMember<P>;

export type EnumDeclarationNode<P extends Phase> = EnumDeclaration<P>;

export type ModuleBlockNode<P extends Phase> = ModuleBlock<P>;

export type NotEmittedStatementNode<P extends Phase> = NotEmittedStatement<P>;

export type NotEmittedTypeElementNode<P extends Phase> = NotEmittedTypeElement<P>;

export type ImportDeclarationNode<P extends Phase> = ImportDeclaration<P>;

export type ExternalModuleReferenceNode<P extends Phase> = ExternalModuleReference<P>;

export type NamespaceImportNode<P extends Phase> = NamespaceImport<P>;

export type NamedImportsNode<P extends Phase> = NamedImports<P>;

export type ExportAssignmentNode<P extends Phase> = ExportAssignment<P>;

export type NamespaceExportDeclarationNode<P extends Phase> = NamespaceExportDeclaration<P>;

export type NamespaceExportNode<P extends Phase> = NamespaceExport<P>;

export type NamedExportsNode<P extends Phase> = NamedExports<P>;

export type ExportSpecifierNode<P extends Phase> = ExportSpecifier<P>;

export type CallSignatureDeclarationNode<P extends Phase> = CallSignatureDeclaration<P>;

export type ConstructSignatureDeclarationNode<P extends Phase> = ConstructSignatureDeclaration<P>;

export type ConstructorDeclarationNode<P extends Phase> = ConstructorDeclaration<P>;

export type GetAccessorDeclarationNode<P extends Phase> = GetAccessorDeclaration<P>;

export type SetAccessorDeclarationNode<P extends Phase> = SetAccessorDeclaration<P>;

export type IndexSignatureDeclarationNode<P extends Phase> = IndexSignatureDeclaration<P>;

export type MethodSignatureDeclarationNode<P extends Phase> = MethodSignatureDeclaration<P>;

export type MethodDeclarationNode<P extends Phase> = MethodDeclaration<P>;

export type PropertySignatureDeclarationNode<P extends Phase> = PropertySignatureDeclaration<P>;

export type PropertyDeclarationNode<P extends Phase> = PropertyDeclaration<P>;

export type SemicolonClassElementNode<P extends Phase> = SemicolonClassElement<P>;

export type ClassStaticBlockDeclarationNode<P extends Phase> = ClassStaticBlockDeclaration<P>;

export type OmittedExpressionNode<P extends Phase> = OmittedExpression<P>;

export type KeywordExpressionNode<P extends Phase> = KeywordExpression<P>;

export type StringLiteralNode<P extends Phase> = StringLiteral<P>;

export type NumericLiteralNode<P extends Phase> = NumericLiteral<P>;

export type BigIntLiteralNode<P extends Phase> = BigIntLiteral<P>;

export type RegularExpressionLiteralNode<P extends Phase> = RegularExpressionLiteral<P>;

export type NoSubstitutionTemplateLiteralNode<P extends Phase> = NoSubstitutionTemplateLiteral<P>;

export type BinaryExpressionNode<P extends Phase> = BinaryExpression<P>;

export type PrefixUnaryExpressionNode<P extends Phase> = PrefixUnaryExpression<P>;

export type PostfixUnaryExpressionNode<P extends Phase> = PostfixUnaryExpression<P>;

export type YieldExpressionNode<P extends Phase> = YieldExpression<P>;

export type ArrowFunctionNode<P extends Phase> = ArrowFunction<P>;

export type FunctionExpressionNode<P extends Phase> = FunctionExpression<P>;

export type AsExpressionNode<P extends Phase> = AsExpression<P>;

export type SatisfiesExpressionNode<P extends Phase> = SatisfiesExpression<P>;

export type ConditionalExpressionNode<P extends Phase> = ConditionalExpression<P>;

export type PropertyAccessExpressionNode<P extends Phase> = PropertyAccessExpression<P>;

export type ElementAccessExpressionNode<P extends Phase> = ElementAccessExpression<P>;

export type CallExpressionNode<P extends Phase> = CallExpression<P>;

export type NewExpressionNode<P extends Phase> = NewExpression<P>;

export type MetaPropertyNode<P extends Phase> = MetaProperty<P>;

export type NonNullExpressionNode<P extends Phase> = NonNullExpression<P>;

export type SpreadElementNode<P extends Phase> = SpreadElement<P>;

export type TemplateExpressionNode<P extends Phase> = TemplateExpression<P>;

export type TemplateSpanNode<P extends Phase> = TemplateSpan<P>;

export type TaggedTemplateExpressionNode<P extends Phase> = TaggedTemplateExpression<P>;

export type ParenthesizedExpressionNode<P extends Phase> = ParenthesizedExpression<P>;

export type ArrayLiteralExpressionNode<P extends Phase> = ArrayLiteralExpression<P>;

export type ObjectLiteralExpressionNode<P extends Phase> = ObjectLiteralExpression<P>;

export type SpreadAssignmentNode<P extends Phase> = SpreadAssignment<P>;

export type PropertyAssignmentNode<P extends Phase> = PropertyAssignment<P>;

export type ShorthandPropertyAssignmentNode<P extends Phase> = ShorthandPropertyAssignment<P>;

export type DeleteExpressionNode<P extends Phase> = DeleteExpression<P>;

export type TypeOfExpressionNode<P extends Phase> = TypeOfExpression<P>;

export type VoidExpressionNode<P extends Phase> = VoidExpression<P>;

export type AwaitExpressionNode<P extends Phase> = AwaitExpression<P>;

export type TypeAssertionNode<P extends Phase> = TypeAssertion<P>;

export type KeywordTypeNodeNode<P extends Phase> = KeywordTypeNode<P>;

export type UnionTypeNodeNode<P extends Phase> = UnionTypeNode<P>;

export type IntersectionTypeNodeNode<P extends Phase> = IntersectionTypeNode<P>;

export type ConditionalTypeNodeNode<P extends Phase> = ConditionalTypeNode<P>;

export type TypeOperatorNodeNode<P extends Phase> = TypeOperatorNode<P>;

export type InferTypeNodeNode<P extends Phase> = InferTypeNode<P>;

export type ArrayTypeNodeNode<P extends Phase> = ArrayTypeNode<P>;

export type IndexedAccessTypeNodeNode<P extends Phase> = IndexedAccessTypeNode<P>;

export type TypeReferenceNodeNode<P extends Phase> = TypeReferenceNode<P>;

export type ExpressionWithTypeArgumentsNode<P extends Phase> = ExpressionWithTypeArguments<P>;

export type LiteralTypeNodeNode<P extends Phase> = LiteralTypeNode<P>;

export type ThisTypeNodeNode<P extends Phase> = ThisTypeNode<P>;

export type TypePredicateNodeNode<P extends Phase> = TypePredicateNode<P>;

export type ImportAttributeNode<P extends Phase> = ImportAttribute<P>;

export type ImportAttributesNode<P extends Phase> = ImportAttributes<P>;

export type TypeQueryNodeNode<P extends Phase> = TypeQueryNode<P>;

export type MappedTypeNodeNode<P extends Phase> = MappedTypeNode<P>;

export type TypeLiteralNodeNode<P extends Phase> = TypeLiteralNode<P>;

export type TupleTypeNodeNode<P extends Phase> = TupleTypeNode<P>;

export type NamedTupleMemberNode<P extends Phase> = NamedTupleMember<P>;

export type OptionalTypeNodeNode<P extends Phase> = OptionalTypeNode<P>;

export type RestTypeNodeNode<P extends Phase> = RestTypeNode<P>;

export type ParenthesizedTypeNodeNode<P extends Phase> = ParenthesizedTypeNode<P>;

export type FunctionTypeNodeNode<P extends Phase> = FunctionTypeNode<P>;

export type ConstructorTypeNodeNode<P extends Phase> = ConstructorTypeNode<P>;

export type TemplateHeadNode<P extends Phase> = TemplateHead<P>;

export type TemplateMiddleNode<P extends Phase> = TemplateMiddle<P>;

export type TemplateTailNode<P extends Phase> = TemplateTail<P>;

export type TemplateLiteralTypeNodeNode<P extends Phase> = TemplateLiteralTypeNode<P>;

export type TemplateLiteralTypeSpanNode<P extends Phase> = TemplateLiteralTypeSpan<P>;

export type PartiallyEmittedExpressionNode<P extends Phase> = PartiallyEmittedExpression<P>;

export type JsxElementNode<P extends Phase> = JsxElement<P>;

export type JsxAttributesNode<P extends Phase> = JsxAttributes<P>;

export type JsxNamespacedNameNode<P extends Phase> = JsxNamespacedName<P>;

export type JsxOpeningElementNode<P extends Phase> = JsxOpeningElement<P>;

export type JsxSelfClosingElementNode<P extends Phase> = JsxSelfClosingElement<P>;

export type JsxFragmentNode<P extends Phase> = JsxFragment<P>;

export type JsxOpeningFragmentNode<P extends Phase> = JsxOpeningFragment<P>;

export type JsxClosingFragmentNode<P extends Phase> = JsxClosingFragment<P>;

export type JsxAttributeNode<P extends Phase> = JsxAttribute<P>;

export type JsxSpreadAttributeNode<P extends Phase> = JsxSpreadAttribute<P>;

export type JsxClosingElementNode<P extends Phase> = JsxClosingElement<P>;

export type JsxExpressionNode<P extends Phase> = JsxExpression<P>;

export type JsxTextNode<P extends Phase> = JsxText<P>;

export type SyntaxListNode<P extends Phase> = SyntaxList<P>;

export type JSDocNode<P extends Phase> = JSDoc<P>;

export type JSDocTypeExpressionNode<P extends Phase> = JSDocTypeExpression<P>;

export type JSDocNonNullableTypeNode<P extends Phase> = JSDocNonNullableType<P>;

export type JSDocNullableTypeNode<P extends Phase> = JSDocNullableType<P>;

export type JSDocAllTypeNode<P extends Phase> = JSDocAllType<P>;

export type JSDocVariadicTypeNode<P extends Phase> = JSDocVariadicType<P>;

export type JSDocOptionalTypeNode<P extends Phase> = JSDocOptionalType<P>;

export type JSDocTypeTagNode<P extends Phase> = JSDocTypeTag<P>;

export type JSDocUnknownTagNode<P extends Phase> = JSDocUnknownTag<P>;

export type JSDocTemplateTagNode<P extends Phase> = JSDocTemplateTag<P>;

export type JSDocReturnTagNode<P extends Phase> = JSDocReturnTag<P>;

export type JSDocPublicTagNode<P extends Phase> = JSDocPublicTag<P>;

export type JSDocPrivateTagNode<P extends Phase> = JSDocPrivateTag<P>;

export type JSDocProtectedTagNode<P extends Phase> = JSDocProtectedTag<P>;

export type JSDocReadonlyTagNode<P extends Phase> = JSDocReadonlyTag<P>;

export type JSDocOverrideTagNode<P extends Phase> = JSDocOverrideTag<P>;

export type JSDocDeprecatedTagNode<P extends Phase> = JSDocDeprecatedTag<P>;

export type JSDocSeeTagNode<P extends Phase> = JSDocSeeTag<P>;

export type JSDocImplementsTagNode<P extends Phase> = JSDocImplementsTag<P>;

export type JSDocAugmentsTagNode<P extends Phase> = JSDocAugmentsTag<P>;

export type JSDocSatisfiesTagNode<P extends Phase> = JSDocSatisfiesTag<P>;

export type JSDocThrowsTagNode<P extends Phase> = JSDocThrowsTag<P>;

export type JSDocThisTagNode<P extends Phase> = JSDocThisTag<P>;

export type JSDocImportTagNode<P extends Phase> = JSDocImportTag<P>;

export type JSDocCallbackTagNode<P extends Phase> = JSDocCallbackTag<P>;

export type JSDocOverloadTagNode<P extends Phase> = JSDocOverloadTag<P>;

export type JSDocTypedefTagNode<P extends Phase> = JSDocTypedefTag<P>;

export type JSDocSignatureNode<P extends Phase> = JSDocSignature<P>;

export type JSDocNameReferenceNode<P extends Phase> = JSDocNameReference<P>;

export type SourceFileNode<P extends Phase> = SourceFile<P>;

export type ModuleDeclarationNode<P extends Phase> = ModuleDeclaration<P>;

export type ImportEqualsDeclarationNode<P extends Phase> = ImportEqualsDeclaration<P>;

export type ExportDeclarationNode<P extends Phase> = ExportDeclaration<P>;

export type ImportTypeNodeNode<P extends Phase> = ImportTypeNode<P>;

export type ImportClauseNode<P extends Phase> = ImportClause<P>;

export type ImportSpecifierNode<P extends Phase> = ImportSpecifier<P>;

export type JSDocTextNode<P extends Phase> = JSDocText<P>;

export type JSDocLinkNode<P extends Phase> = JSDocLink<P>;

export type JSDocLinkPlainNode<P extends Phase> = JSDocLinkPlain<P>;

export type JSDocLinkCodeNode<P extends Phase> = JSDocLinkCode<P>;

export type TypeParameterDeclarationNode<P extends Phase> = TypeParameterDeclaration<P>;

export type SyntheticReferenceExpressionNode<P extends Phase> = SyntheticReferenceExpression<P>;

export type JSDocTypeLiteralNode<P extends Phase> = JSDocTypeLiteral<P>;

export type JSDocParameterOrPropertyTagNode<P extends Phase> = JSDocParameterOrPropertyTag<P>;

export type SyntaxNode<P extends Phase> =
  | ExcludedExpression<P>
  | Token<P>
  | Identifier<P>
  | PrivateIdentifier<P>
  | QualifiedName<P>
  | ComputedPropertyName<P>
  | Decorator<P>
  | EmptyStatement<P>
  | IfStatement<P>
  | DoStatement<P>
  | WhileStatement<P>
  | ForStatement<P>
  | ForInOrOfStatement<P>
  | BreakStatement<P>
  | ContinueStatement<P>
  | ReturnStatement<P>
  | WithStatement<P>
  | SwitchStatement<P>
  | CaseBlock<P>
  | CaseOrDefaultClause<P>
  | ThrowStatement<P>
  | TryStatement<P>
  | CatchClause<P>
  | DebuggerStatement<P>
  | LabeledStatement<P>
  | ExpressionStatement<P>
  | Block<P>
  | VariableStatement<P>
  | VariableDeclaration<P>
  | VariableDeclarationList<P>
  | BindingPattern<P>
  | ParameterDeclaration<P>
  | BindingElement<P>
  | MissingDeclaration<P>
  | FunctionDeclaration<P>
  | ClassDeclaration<P>
  | ClassExpression<P>
  | HeritageClause<P>
  | InterfaceDeclaration<P>
  | TypeAliasDeclaration<P>
  | EnumMember<P>
  | EnumDeclaration<P>
  | ModuleBlock<P>
  | NotEmittedStatement<P>
  | NotEmittedTypeElement<P>
  | ImportDeclaration<P>
  | ExternalModuleReference<P>
  | NamespaceImport<P>
  | NamedImports<P>
  | ExportAssignment<P>
  | NamespaceExportDeclaration<P>
  | NamespaceExport<P>
  | NamedExports<P>
  | ExportSpecifier<P>
  | CallSignatureDeclaration<P>
  | ConstructSignatureDeclaration<P>
  | ConstructorDeclaration<P>
  | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P>
  | IndexSignatureDeclaration<P>
  | MethodSignatureDeclaration<P>
  | MethodDeclaration<P>
  | PropertySignatureDeclaration<P>
  | PropertyDeclaration<P>
  | SemicolonClassElement<P>
  | ClassStaticBlockDeclaration<P>
  | OmittedExpression<P>
  | KeywordExpression<P>
  | StringLiteral<P>
  | NumericLiteral<P>
  | BigIntLiteral<P>
  | RegularExpressionLiteral<P>
  | NoSubstitutionTemplateLiteral<P>
  | BinaryExpression<P>
  | PrefixUnaryExpression<P>
  | PostfixUnaryExpression<P>
  | YieldExpression<P>
  | ArrowFunction<P>
  | FunctionExpression<P>
  | AsExpression<P>
  | SatisfiesExpression<P>
  | ConditionalExpression<P>
  | PropertyAccessExpression<P>
  | ElementAccessExpression<P>
  | CallExpression<P>
  | NewExpression<P>
  | MetaProperty<P>
  | NonNullExpression<P>
  | SpreadElement<P>
  | TemplateExpression<P>
  | TemplateSpan<P>
  | TaggedTemplateExpression<P>
  | ParenthesizedExpression<P>
  | ArrayLiteralExpression<P>
  | ObjectLiteralExpression<P>
  | SpreadAssignment<P>
  | PropertyAssignment<P>
  | ShorthandPropertyAssignment<P>
  | DeleteExpression<P>
  | TypeOfExpression<P>
  | VoidExpression<P>
  | AwaitExpression<P>
  | TypeAssertion<P>
  | KeywordTypeNode<P>
  | UnionTypeNode<P>
  | IntersectionTypeNode<P>
  | ConditionalTypeNode<P>
  | TypeOperatorNode<P>
  | InferTypeNode<P>
  | ArrayTypeNode<P>
  | IndexedAccessTypeNode<P>
  | TypeReferenceNode<P>
  | ExpressionWithTypeArguments<P>
  | LiteralTypeNode<P>
  | ThisTypeNode<P>
  | TypePredicateNode<P>
  | ImportAttribute<P>
  | ImportAttributes<P>
  | TypeQueryNode<P>
  | MappedTypeNode<P>
  | TypeLiteralNode<P>
  | TupleTypeNode<P>
  | NamedTupleMember<P>
  | OptionalTypeNode<P>
  | RestTypeNode<P>
  | ParenthesizedTypeNode<P>
  | FunctionTypeNode<P>
  | ConstructorTypeNode<P>
  | TemplateHead<P>
  | TemplateMiddle<P>
  | TemplateTail<P>
  | TemplateLiteralTypeNode<P>
  | TemplateLiteralTypeSpan<P>
  | PartiallyEmittedExpression<P>
  | JsxElement<P>
  | JsxAttributes<P>
  | JsxNamespacedName<P>
  | JsxOpeningElement<P>
  | JsxSelfClosingElement<P>
  | JsxFragment<P>
  | JsxOpeningFragment<P>
  | JsxClosingFragment<P>
  | JsxAttribute<P>
  | JsxSpreadAttribute<P>
  | JsxClosingElement<P>
  | JsxExpression<P>
  | JsxText<P>
  | SyntaxList<P>
  | JSDoc<P>
  | JSDocTypeExpression<P>
  | JSDocNonNullableType<P>
  | JSDocNullableType<P>
  | JSDocAllType<P>
  | JSDocVariadicType<P>
  | JSDocOptionalType<P>
  | JSDocTypeTag<P>
  | JSDocUnknownTag<P>
  | JSDocTemplateTag<P>
  | JSDocReturnTag<P>
  | JSDocPublicTag<P>
  | JSDocPrivateTag<P>
  | JSDocProtectedTag<P>
  | JSDocReadonlyTag<P>
  | JSDocOverrideTag<P>
  | JSDocDeprecatedTag<P>
  | JSDocSeeTag<P>
  | JSDocImplementsTag<P>
  | JSDocAugmentsTag<P>
  | JSDocSatisfiesTag<P>
  | JSDocThrowsTag<P>
  | JSDocThisTag<P>
  | JSDocImportTag<P>
  | JSDocCallbackTag<P>
  | JSDocOverloadTag<P>
  | JSDocTypedefTag<P>
  | JSDocSignature<P>
  | JSDocNameReference<P>
  | SourceFile<P>
  | ModuleDeclaration<P>
  | ImportEqualsDeclaration<P>
  | ExportDeclaration<P>
  | ImportTypeNode<P>
  | ImportClause<P>
  | ImportSpecifier<P>
  | JSDocText<P>
  | JSDocLink<P>
  | JSDocLinkPlain<P>
  | JSDocLinkCode<P>
  | TypeParameterDeclaration<P>
  | SyntheticReferenceExpression<P>
  | JSDocTypeLiteral<P>
  | JSDocParameterOrPropertyTag<P>;

export type BodyRoot<P extends Phase> = SourceFile<P> | Block<P> | Expression<P>;

export interface HirCheckerViews {
  readonly read: CapturedFact<TyId>;
  readonly declared: CapturedFact<TyId | null>;
  readonly contextual: CapturedFact<TyId | null>;
}

export type ImportTarget =
  | { readonly target: "project"; readonly module: ModuleId }
  | { readonly target: "library"; readonly module: LibraryModuleIdentity };

export interface IntrinsicValueResolution {
  readonly kind: "intrinsic-value";
  readonly intrinsic: "undefined";
}

export type HirResolution =
  | { readonly kind: "local"; readonly local: LocalRef }
  | IntrinsicValueResolution
  | HirBindingTarget
  | Extract<CapturedFact<never>, { readonly kind: "unavailable" }>;

export type HirModifier = "export" | "default" | "declare" | "abstract" | "static" | "readonly"
  | "public" | "protected" | "private" | "override" | "async" | "generator" | "const";

export interface HirAttribute {
  readonly declaration: DefId;
  readonly occurrence: SourceNodeRef;
  readonly arguments: readonly SourceNodeRef[];
}

export interface DeclarationAttributes {
  readonly definition: DefId;
  readonly bindings: ArtifactBindings;
  readonly attributes: readonly HirAttribute[];
}

export type HirArgument =
  | { readonly kind: "value"; readonly expression: NodeId }
  | { readonly kind: "spread"; readonly expression: NodeId; readonly tuple: CapturedFact<readonly TyId[] | null> };

export interface HirInferenceContribution {
  readonly parameter: DefId;
  readonly role: "argument" | "receiver" | "context" | "result" | "type-argument";
  readonly source: SourceNodeRef;
  readonly component: TypeComponent;
  readonly type: CapturedFact<TyId>;
}

export interface HirCallableEndpoint {
  readonly declaration: DefId;
  readonly role: SignatureEndpoint;
  readonly signature: SigId;
  readonly body: BodyId | null;
}

// The identity of one endpoint record: its declaration, role, signature and body.
export type CallableEndpointKey = (endpoint: HirCallableEndpoint) => string;

// The roles of the two endpoints of one selected application. `overloaded` says whether the endpoint family of the
// selected declaration has an advertised row. Bit 1: the advertised endpoint is not an advertised row of an overloaded
// family, or is not the same complete endpoint as the API endpoint of a family without advertised rows. Bit 2: the API
// endpoint is an advertised row, an API body without a body, or an API signature with one. Membership of the two
// endpoints in the family is the caller's check.
export type EndpointRoleFaults = 0 | 1 | 2 | 3;
export type HasOverloadEndpoints = (endpoints: readonly HirCallableEndpoint[]) => boolean;
export type SelectedEndpointRoleFaults = (
  overloaded: boolean,
  advertised: HirCallableEndpoint,
  api: HirCallableEndpoint,
) => EndpointRoleFaults;

export interface HirCandidate {
  readonly ordinal: number;
  readonly declaration: DefId;
  readonly appliedSignature: CapturedFact<SigId>;
  readonly bindings: CapturedFact<BindingVector>;
  readonly conditionalFailure: CapturedFact<Diagnostic | null>;
  readonly contributions: readonly HirInferenceContribution[];
}

export interface HirApplication {
  readonly kind: "call" | "construct" | "accessor-get" | "accessor-set";
  readonly receiver: NodeId | null;
  readonly arguments: readonly HirArgument[];
  readonly typeArguments: readonly TyId[];
  readonly candidates: CapturedFact<CandidateListId>;
  readonly resolvedSignature: CapturedFact<SigId | null>;
}

export interface HirCandidateList {
  readonly id: CandidateListId;
  readonly candidates: readonly HirCandidate[];
}

export type HirProtocolFact =
  | { readonly kind: "iterate" | "spread"; readonly asynchronous: boolean; readonly subject: NodeId;
      readonly iterator: TyId; readonly element: TyId; readonly completion: TyId; readonly sent: TyId;
      readonly next: SigId; readonly finish: SigId | null; readonly fail: SigId | null }
  | { readonly kind: "await"; readonly subject: NodeId; readonly completion: TyId }
  | { readonly kind: "yield" | "delegate"; readonly subject: NodeId | null; readonly yielded: TyId;
      readonly sent: TyId; readonly completion: TyId }
  | { readonly kind: "dispose"; readonly subject: NodeId; readonly asynchronous: boolean; readonly signature: SigId };

export interface HirStoragePlace {
  readonly base:
    | { readonly kind: "root"; readonly resolution: HirResolution }
    | { readonly kind: "place"; readonly node: NodeId }
    | { readonly kind: "receiver"; readonly node: NodeId };
  readonly step:
    | { readonly kind: "member"; readonly key: MemberKey; readonly origins: readonly MemberOrigin[] }
    | { readonly kind: "index"; readonly expression: NodeId }
    | { readonly kind: "deref" }
    | null;
  readonly read: CapturedFact<TyId>;
  readonly write: CapturedFact<TyId | null>;
}

export type WritableRootStorageOf = (place: CapturedFact<HirStoragePlace>, resolution: HirResolution) => TyId | null;
export type ReadWriteRootStorageOf = (place: CapturedFact<HirStoragePlace>, resolution: HirResolution) => TyId | null;
export type CheckedMemberStorageOf = (access: PropertyAccessExpression<CheckedPhase> | ElementAccessExpression<CheckedPhase>) =>
  { readonly read: TyId | null; readonly write: TyId } | null;
export type CheckedVariableStorageOf = (declaration: VariableDeclaration<CheckedPhase>) => TyId | null;

export interface CheckedSourceStorageRead extends HirBindingViews {
  readonly bodyOf: (body: BodyId) => HirBody | null;
  readonly nodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly itemOf: (definition: DefId) => HirNode | null;
  readonly admit: (work: number, records: number) => boolean;
}

export interface CheckedSourceObjectRead extends CheckedSourceStorageRead {
  readonly typeOf: (type: TyId) => TypeTerm | undefined;
}

export type CheckedSourceObjectHoldingOf = (body: HirBody, local: LocalRef,
  read: CheckedSourceObjectRead,
) => SourceObjectHolding | null;

export interface ReferenceArgumentRequest {
  readonly argument: NodeRef;
  readonly caller: TyId;
  readonly endpoint: HirCallableEndpoint;
  readonly ordinal: number;
  readonly formal: SignatureParameter;
}

export interface CheckedReferenceArgumentSite extends ReferenceArgumentRequest {
  readonly body: HirBody;
}

export type CheckedReferenceArgumentViewOf = (site: CheckedReferenceArgumentSite, read: CheckedSourceObjectRead) => ReferenceArgumentView | null;

export type CheckedSourceObjectFieldReader = (access: PropertyAccessExpression<CheckedPhase>) => SourceObjectField | null;
export interface CheckedSourceObjectFields {
  readonly field: CheckedSourceObjectFieldReader;
  readonly ready: (node: NodeId) => SourceObjectField | null;
}
export type CheckedSourceObjectFieldsOf = (body: HirBody, read: CheckedSourceObjectRead) => CheckedSourceObjectFields;

export type CheckedBindingKeyOf = (element: BindingElement<CheckedPhase>) => MemberKey | null;

export type CheckedSourceBindingFieldOf = (body: HirBody, element: BindingElement<CheckedPhase>, key: MemberKey, field: DefId,
  read: CheckedSourceObjectRead,
) => SourceObjectField | null;

export interface HirMemoryGeometryCapture {
  readonly source: CapturedFact<TyId>;
  readonly dataLayoutExpression: SourceNodeRef | null;
  readonly dataLayout: CapturedFact<DefId>;
  readonly byteSizeExpression: SourceNodeRef | null;
  readonly byteSize: CapturedFact<bigint>;
  readonly byteAlignmentExpression: SourceNodeRef | null;
  readonly byteAlignment: CapturedFact<bigint>;
  readonly strideExpression: SourceNodeRef | null;
  readonly stride: CapturedFact<bigint>;
}

interface HirMemoryLayoutOccurrence {
  readonly occurrence: SourceNodeRef;
  readonly bindings: CapturedFact<BindingVector>;
}

export type HirMemoryLayoutCapture = HirAuthoredMemoryLayoutCapture | (HirMemoryLayoutOccurrence & {
  readonly kind: "data-layout"; readonly declaration: CapturedFact<DefId>;
  readonly fingerprint: CapturedFact<string>; readonly byteOrder: CapturedFact<"little" | "big">;
  readonly addressWidth: CapturedFact<32 | 64>;
});

export type HirAuthoredMemoryLayoutCapture = HirMemoryLayoutOccurrence & (
  | { readonly kind: "value"; readonly geometry: HirMemoryGeometryCapture;
      readonly fieldExpressions: readonly SourceNodeRef[]; readonly fields: CapturedFact<readonly SourceNodeRef[]> }
  | { readonly kind: "array"; readonly geometry: HirMemoryGeometryCapture;
      readonly extentExpression: SourceNodeRef | null; readonly length: CapturedFact<bigint>;
      readonly runtimeBase: CapturedFact<"number" | "bigint">;
      readonly elementExpression: SourceNodeRef | null; readonly element: CapturedFact<SourceNodeRef> }
);

export interface HirMemoryFieldCapture {
  readonly kind: "field";
  readonly occurrence: SourceNodeRef;
  readonly bindings: CapturedFact<BindingVector>;
  readonly source: CapturedFact<TyId>;
  readonly selector: SourceNodeRef;
  readonly value: CapturedFact<TyId>;
  readonly fieldLayoutExpression: SourceNodeRef | null;
  readonly fieldLayout: CapturedFact<SourceNodeRef>;
  readonly byteOffsetExpression: SourceNodeRef | null;
  readonly byteOffset: CapturedFact<bigint>;
  readonly byteAlignmentExpression: SourceNodeRef | null;
  readonly byteAlignment: CapturedFact<bigint>;
}

export interface HirObservationCapture {
  readonly occurrence: NodeRef;
  readonly operation: "size" | "alignment" | "stride" | "field-offset";
  readonly bindings: CapturedFact<BindingVector>;
  readonly operand: NodeRef;
  readonly layout: CapturedFact<SourceNodeRef>;
  readonly selector: SourceNodeRef | null;
  readonly field: CapturedFact<SourceNodeRef | null>;
  readonly result: CapturedFact<TyId>;
  readonly value: CapturedFact<bigint>;
}

export type LayoutCallRole = "value-layout" | "array-layout" | "field-layout" | "size" | "alignment" | "stride" | "field-offset";

export type LayoutDescriptorKind = "value" | "array" | "field";
export interface LayoutSelectorSyntax<P extends Phase> {
  readonly arrow: ArrowFunction<P>;
  readonly formal: ParameterDeclaration<P>;
  readonly access: PropertyAccessExpression<P>;
  readonly receiver: Identifier<P>;
}
export type ReadLayoutSelector = <P extends Phase, Stop extends object>(input: Expression<P>,
  admit: (work: number, created: number) => Stop | null) =>
  { readonly kind: "complete"; readonly value: LayoutSelectorSyntax<P> }
  | { readonly kind: "invalid"; readonly fault: { readonly kind: "invalid-selector"; readonly at: NodeId } }
  | { readonly kind: "resource-stop"; readonly stop: Stop };

export type LayoutDescriptorOperand = "datalayout" | "bytesize" | "bytealignment" | "stride" | "fields" |
  "elementlayout" | "length" | "select" | "byteoffset" | "fieldlayout";
interface LayoutGeometrySyntax<P extends Phase> {
  readonly datalayout: Expression<P>;
  readonly bytesize: Expression<P>;
  readonly bytealignment: Expression<P>;
  readonly stride: Expression<P>;
}
export type LayoutDescriptorSyntax<P extends Phase> = { readonly descriptor: ObjectLiteralExpression<P> } & (
  | ({ readonly kind: "value"; readonly fields: ArrayLiteralExpression<P> } & LayoutGeometrySyntax<P>)
  | ({ readonly kind: "array"; readonly elementlayout: Expression<P>; readonly length: Expression<P> } & LayoutGeometrySyntax<P>)
  | { readonly kind: "field"; readonly select: LayoutSelectorSyntax<P>; readonly byteoffset: Expression<P>;
      readonly bytealignment: Expression<P>; readonly fieldlayout: Expression<P> }
);
export type LayoutDescriptorSyntaxFault =
  | { readonly kind: "not-inline" | "invalid-property" | "not-inline-fields" | "invalid-field-entry" | "invalid-selector"; readonly at: NodeId }
  | { readonly kind: "unknown-property"; readonly at: NodeId; readonly name: string }
  | { readonly kind: "duplicate-property" | "missing-property"; readonly at: NodeId; readonly name: LayoutDescriptorOperand };
export type ReadLayoutDescriptor = <P extends Phase, Stop extends object>(input: Expression<P>, kind: LayoutDescriptorKind,
  admit: (work: number, created: number) => Stop | null, field: (operand: Expression<P>) => Stop | null) =>
  { readonly kind: "complete"; readonly value: LayoutDescriptorSyntax<P> }
  | { readonly kind: "invalid"; readonly fault: LayoutDescriptorSyntaxFault }
  | { readonly kind: "resource-stop"; readonly stop: Stop };

export type CheckedLayoutRoleOf = (call: CallExpression<CheckedPhase>) => LayoutCallRole | null;
export type CheckedLayoutGeometryOperands = (capture: HirAuthoredMemoryLayoutCapture | HirMemoryFieldCapture) => readonly SourceNodeRef[];

export type CheckedLayoutConstructionOf = (node: HirNode) =>
  HirAuthoredMemoryLayoutCapture | HirMemoryFieldCapture | null;

export interface CheckedLayoutSourceDeps<Stop extends object> extends HirBindingViews {
  readonly admit: (work: number, records: number) => Stop | null;
  readonly nodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly declarationSourceOf: (definition: DefId) => SourceNodeRef | null;
  readonly localDeclarationOf: (local: LocalRef) => SourceNodeRef | null;
  readonly parentOf: (node: HirNode) => HirNode | null;
  readonly itemOf: (node: HirNode) => ItemNodeRef | null;
}

export interface CheckedLayoutSource {
  readonly definition: DefId;
  readonly capture: HirMemoryLayoutCapture | HirMemoryFieldCapture;
  readonly node: HirNode;
}

export type ResolveCheckedLayout = <Stop extends object>(deps: CheckedLayoutSourceDeps<Stop>, reference: SourceNodeRef) =>
  | { readonly kind: "complete"; readonly value: CheckedLayoutSource | null }
  | { readonly kind: "resource-stop"; readonly stop: Stop };

export interface CheckedLayoutAlias {
  readonly read: NodeRef;
  readonly descriptor: SourceNodeRef;
}

export type ResolveCheckedLayoutAlias = <Stop extends object>(deps: CheckedLayoutSourceDeps<Stop>, body: HirBody) =>
  | { readonly kind: "complete"; readonly value: CheckedLayoutAlias | null }
  | { readonly kind: "resource-stop"; readonly stop: Stop };

export type HirUnaryOperator = "+" | "-" | "!" | "~" | "++" | "--" | "typeof" | "void" | "delete";
export type HirBinaryOperator = "+" | "-" | "*" | "/" | "%" | "**" | "&" | "|" | "^"
  | "<<" | ">>" | ">>>" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "===" | "!==" | "in" | "instanceof";
export type HirAssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "**=" | "&="
  | "|=" | "^=" | "<<=" | ">>=" | ">>>=" | "&&=" | "||=" | "??=";
export type BinaryOperatorOf = (token: BinaryOperator) => HirBinaryOperator | null;
export type CompoundAssignmentOperatorOf = (token: BinaryOperator) => HirBinaryOperator | null;
export type ShortCircuitOperatorOf = (token: BinaryOperator, role: "short-circuit" | "assignment") => "and" | "or" | "coalesce" | null;
export type PrefixOperatorOf = (token: PrefixUnaryOperatorToken) => "+" | "-" | "!" | "~" | "++" | "--";

export interface HirCapturedType {
  readonly type: CapturedFact<TyId>;
  readonly component: TypeComponent;
}

export interface HirFieldMarkerCapture {
  readonly name: string;
  readonly typeNode: SourceNodeRef;
  readonly type: CapturedFact<TyId>;
  readonly readonly: boolean;
}

export interface HirMarkerApplication {
  readonly role: "struct" | "field";
  readonly occurrence: NodeRef;
  readonly declaration: DefId;
}

export interface HirMarkersCapture {
  readonly struct: { readonly valueType: boolean; readonly fields: CapturedFact<readonly HirFieldMarkerCapture[]> } | null;
  readonly field: HirFieldMarkerCapture | null;
  readonly defaultValue: { readonly typeNode: SourceNodeRef; readonly type: CapturedFact<TyId> } | null;
  readonly jsString: boolean;
  readonly application: CapturedFact<HirMarkerApplication | null>;
}

export type HirPointerTypeCapture =
  | { readonly kind: "raw-address" }
  | { readonly kind: "typed-location"; readonly pointee: HirCapturedType; readonly mutability: "readonly" | "readwrite" | "unspecified" }
  | { readonly kind: "native-pointer"; readonly declaration: DefId }
  | { readonly kind: "function-pointer"; readonly declaration: DefId;
      readonly parameters: readonly HirCapturedType[]; readonly result: HirCapturedType; readonly abi: readonly string[] };

export interface HirIntegerOperandCapture {
  readonly runtimeBase: "number" | "bigint";
  readonly signedness: "signed" | "unsigned";
  readonly width: 8 | 16 | 32 | 64 | 128;
}

export type HirAddressIntegerCapture =
  | { readonly width: 32; readonly runtimeBase: "number"; readonly signedness: "unsigned" }
  | { readonly width: 64; readonly runtimeBase: "bigint"; readonly signedness: "unsigned" };

export type HirPointerOperationCapture =
  | { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store"
      | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
      readonly exportName: string; readonly arguments: readonly SourceNodeRef[]; readonly typeArguments: readonly SourceNodeRef[];
      readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited";
      readonly pointee: "available" | "unvisited" | "not-applicable" | "missing" }
  | { readonly family: "typed-location"; readonly operation: "view"; readonly pointer: SourceNodeRef;
      readonly read: SourceNodeRef; readonly write: SourceNodeRef; readonly optional: boolean }
  | { readonly family: "native-pointer"; readonly operation: "load"; readonly pointer: SourceNodeRef }
  | { readonly family: "native-pointer"; readonly operation: "store"; readonly pointer: SourceNodeRef; readonly value: SourceNodeRef }
  | { readonly family: "native-pointer"; readonly operation: "offset"; readonly pointer: SourceNodeRef; readonly offset: SourceNodeRef }
  | { readonly family: "raw-address"; readonly operation: "bind-raw-pointer"; readonly identity: SourceNodeRef }
  | { readonly family: "raw-address"; readonly operation: "equal-raw-pointer"; readonly left: SourceNodeRef; readonly right: SourceNodeRef }
  | { readonly family: "raw-address"; readonly operation: "hash-raw-pointer"; readonly pointer: SourceNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "to-raw"; readonly pointer: SourceNodeRef; readonly layout: SourceNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "reinterpret"; readonly raw: SourceNodeRef; readonly layout: SourceNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "byte-offset"; readonly raw: SourceNodeRef; readonly offset: SourceNodeRef;
      readonly integer: HirIntegerOperandCapture; readonly dataLayout: SourceNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer"; readonly raw: SourceNodeRef;
      readonly integer: HirAddressIntegerCapture; readonly dataLayout: SourceNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw"; readonly address: SourceNodeRef;
      readonly integer: HirAddressIntegerCapture; readonly dataLayout: SourceNodeRef }
  | { readonly family: "keep-alive"; readonly operation: "keep-alive"; readonly value: SourceNodeRef };

export type HirAttributeCapture = {
  readonly occurrence: SourceNodeRef;
  readonly applicationTarget: SourceNodeRef;
  readonly selectedMember: { readonly selectedDeclaration: SourceNodeRef | null; readonly declarations: readonly SourceNodeRef[] } | null;
  readonly applicationMemberKind: "property" | "method" | null;
  readonly applicationPlacement: "declaration" | "constructor" | null;
  readonly applicationParameterName: string | null;
  readonly applicationTargetSpecifier: string | null;
} & (
  | { readonly kind: "builder-state" }
  | { readonly kind: "application"; readonly invocation: SourceNodeRef }
);

export type HirSafetySelectionCapture =
  | { readonly kind: "selected"; readonly expression: SourceNodeRef;
      readonly declaration: SourceNodeRef | null; readonly declarations: readonly SourceNodeRef[] }
  | { readonly kind: "unavailable"; readonly reason: "function-shape" | "receiver" | "member-evidence" };

export type HirSafetyCapture = {
  readonly occurrence: SourceNodeRef;
  readonly provider: DefId;
} & (
  | { readonly family: "unsafe-context"; readonly operation: "expression"; readonly expression: SourceNodeRef }
  | { readonly family: "unsafe-context"; readonly operation: "remaining-block"; readonly firstDirectStatement: boolean }
  | { readonly family: "safety"; readonly operation: "root"; readonly form: "type" | "value"; readonly target: SourceNodeRef | null }
  | { readonly family: "safety"; readonly operation: "select-member"; readonly predecessor: SourceNodeRef | null;
      readonly memberKind: "indexer" | "method" | "property"; readonly selection: HirSafetySelectionCapture }
  | { readonly family: "safety"; readonly operation: "placement"; readonly predecessor: SourceNodeRef | null;
      readonly placement: "declaration" | "constructor" | "getter" | "setter" }
  | { readonly family: "safety"; readonly operation: "apply"; readonly predecessor: SourceNodeRef | null;
      readonly contract: "requires-unsafe" | "safe" }
);

export type HirArgumentPassingCapture =
  | { readonly role: "declaration"; readonly mode: PassingMode }
  | { readonly role: "argument"; readonly mode: PassingMode; readonly storageExpression: SourceNodeRef };

export interface HirFieldBindingCapture {
  readonly occurrence: NodeRef;
  readonly bindings: CapturedFact<BindingVector>;
  readonly owner: CapturedFact<TyId>;
  readonly pointee: CapturedFact<TyId>;
  readonly fieldExpression: NodeRef;
  readonly field: CapturedFact<SourceNodeRef>;
  readonly pointerExpression: NodeRef;
}

export interface HirRecordFieldBindingCapture {
  readonly expression: NodeRef;
  readonly binding: NodeRef;
}

export interface HirRecordBindingCapture {
  readonly occurrence: NodeRef;
  readonly bindings: CapturedFact<BindingVector>;
  readonly source: CapturedFact<TyId>;
  readonly layoutExpression: NodeRef;
  readonly layout: CapturedFact<SourceNodeRef>;
  readonly fields: readonly HirRecordFieldBindingCapture[];
}

export interface HirCoreCapture {
  readonly provider: CapturedFact<DefId | null>;
  readonly markers: CapturedFact<HirMarkersCapture>;
  readonly pointerType: CapturedFact<HirPointerTypeCapture | null>;
  readonly pointerOperation: CapturedFact<HirPointerOperationCapture | null>;
  readonly fieldBinding: CapturedFact<HirFieldBindingCapture | null>;
  readonly recordBinding: CapturedFact<HirRecordBindingCapture | null>;
  readonly attribute: CapturedFact<HirAttributeCapture | null>;
  readonly safety: CapturedFact<HirSafetyCapture | null>;
  readonly argumentPassing: CapturedFact<HirArgumentPassingCapture | null>;
  readonly flowState: CapturedFact<"moved" | "borrowed-shared" | "borrowed-mut" | null>;
}

export interface HirCoreCarrier {
  readonly core: HirCoreCapture;
}

export interface CheckedValue {
  readonly views: HirCheckerViews;
  readonly place: CapturedFact<HirStoragePlace | null>;
  readonly memory: CapturedFact<HirMemoryLayoutCapture | HirMemoryFieldCapture | null>;
  readonly observation: CapturedFact<HirObservationCapture | null>;
}

export interface CheckedExpression extends CheckedValue, HirCoreCarrier {}

export type CheckedLiteral = HirCoreCarrier & (
  | { readonly role: "value"; readonly value: CheckedValue; readonly literal: LiteralValue }
  | { readonly role: "property-name"; readonly key: CapturedFact<MemberKey>;
      readonly origins: CapturedFact<readonly MemberOrigin[]> }
  | { readonly role: "declaration-name"; readonly declaration: DeclarationTarget }
  | { readonly role: "type-literal"; readonly type: CapturedFact<TyId>; readonly literal: LiteralTypeValue }
  | { readonly role: "module-specifier"; readonly target: CapturedFact<ImportTarget> }
  | { readonly role: "export-name"; readonly binding: SourceNodeRef }
  | { readonly role: "attribute-value"; readonly literal: LiteralValue }
);

export type CheckedName = HirCoreCarrier & (
  | { readonly role: "value"; readonly value: CheckedValue; readonly resolution: HirResolution }
  | { readonly role: "assignment-target"; readonly resolution: HirResolution;
      readonly views: HirCheckerViews; readonly place: CapturedFact<HirStoragePlace>;
      readonly access: "write" | "read-write" }
  | { readonly role: "declaration-name"; readonly declaration: DeclarationTarget }
  | { readonly role: "enum-qualifier"; readonly resolution: HirResolution; readonly nominal: DefId }
  | { readonly role: "binding-name"; readonly binding: SourceNodeRef }
  | { readonly role: "property-name"; readonly key: CapturedFact<MemberKey>;
      readonly origins: CapturedFact<readonly MemberOrigin[]> }
  | { readonly role: "type-name"; readonly resolution: HirResolution }
  | { readonly role: "label"; readonly target: NodeRef | null }
  | { readonly role: "private-name"; readonly declaration: DefId }
  | { readonly role: "shorthand-value"; readonly value: CheckedValue; readonly resolution: HirResolution;
      readonly key: CapturedFact<MemberKey> }
);

export type CheckedBinary = HirCoreCarrier & (
  | { readonly role: "arithmetic" | "comparison" | "short-circuit" | "sequence"; readonly value: CheckedValue }
  | { readonly role: "assignment"; readonly value: CheckedValue; readonly target: CapturedFact<HirStoragePlace> }
);

export type CheckedUnary = HirCoreCarrier & (
  | { readonly role: "value"; readonly value: CheckedValue }
  | { readonly role: "update"; readonly value: CheckedValue; readonly target: CapturedFact<HirStoragePlace> }
  | { readonly role: "type-literal"; readonly type: CapturedFact<TyId>; readonly literal: LiteralTypeValue }
);

export type CheckedKeyword = HirCoreCarrier & (
  | { readonly role: "value"; readonly value: CheckedValue }
  | { readonly role: "type-literal"; readonly type: CapturedFact<TyId>; readonly literal: LiteralTypeValue }
);

export type CheckedInstantiation = HirCoreCarrier & (
  | { readonly role: "value"; readonly value: CheckedValue }
  | { readonly role: "heritage"; readonly type: CapturedFact<TyId>; readonly declarations: CapturedFact<readonly DefId[]> }
);

export type CheckedAggregate = HirCoreCarrier & (
  | { readonly role: "value"; readonly value: CheckedValue }
  | { readonly role: "assignment-pattern"; readonly views: HirCheckerViews }
  | { readonly role: "layout-quote"; readonly call: NodeRef; readonly views: HirCheckerViews }
);

export interface CheckedApplication extends CheckedValue, HirCoreCarrier {
  readonly application: CapturedFact<HirApplication>;
}

export type CheckedMember = HirCoreCarrier & (
  | { readonly role: "value"; readonly value: CheckedValue;
      readonly origins: CapturedFact<readonly MemberOrigin[]>;
      readonly accessor: CapturedFact<HirApplication | null> }
  | { readonly role: "enum-member"; readonly value: CheckedValue; readonly selectedMember: ItemNodeRef }
  | { readonly role: "array-extent"; readonly value: CheckedValue; readonly selectedMember: ItemNodeRef }
  | { readonly role: "assignment-target"; readonly views: HirCheckerViews;
      readonly place: CapturedFact<HirStoragePlace>; readonly access: "write" | "read-write";
      readonly origins: CapturedFact<readonly MemberOrigin[]>;
      readonly accessor: CapturedFact<HirApplication | null> }
);

export interface CheckedProtocol extends CheckedValue, HirCoreCarrier {
  readonly protocol: CapturedFact<HirProtocolFact>;
}

export interface CheckedClosure extends CheckedValue, HirCoreCarrier {
  readonly body: BodyId;
  readonly captures: readonly LocalRef[];
}

export interface CheckedType extends HirCoreCarrier {
  readonly type: CapturedFact<TyId>;
  readonly referencedDefinitions: readonly DefId[];
}

export type DeclarationTarget =
  | { readonly kind: "local"; readonly local: LocalRef }
  | { readonly kind: "definition"; readonly definition: DefId };

export interface CheckedDeclarationFacts extends HirCoreCarrier {
  readonly parent: DefId | null;
  readonly attributes: readonly HirAttribute[];
  readonly memory: CapturedFact<HirMemoryLayoutCapture | HirMemoryFieldCapture | null>;
}

export interface CheckedDeclaration extends CheckedDeclarationFacts {
  readonly definition: DefId;
}

export interface CheckedCallableType extends CheckedType, CheckedDeclaration {}

export interface CheckedFieldSelector extends CheckedDeclaration {
  readonly role: "layout-selector";
  readonly call: NodeRef;
  readonly views: HirCheckerViews;
  readonly formal: ItemNodeRef;
  readonly selection: NodeRef;
  readonly ownerType: TyId;
  readonly valueType: TyId;
  readonly member: MemberStorageSelection;
}

export interface CheckedCallable extends CheckedDeclaration {
  readonly parameters: readonly TypeParameter[];
  readonly signatures: readonly HirCallableEndpoint[];
  readonly body: BodyId | null;
}

export interface CheckedClass extends CheckedDeclaration {
  readonly parameters: readonly TypeParameter[];
  readonly heritage: readonly HirHeritage[];
  readonly members: readonly DefId[];
}

export interface HirHeritage {
  readonly role: "extends" | "implements";
  readonly type: TyId;
}

export interface CheckedClassExpression extends CheckedExpression, CheckedClass {}

export interface CheckedTypeAlias extends CheckedDeclaration {
  readonly parameters: readonly TypeParameter[];
  readonly type: CapturedFact<TyId>;
}

export interface CheckedVariable extends CheckedDeclarationFacts {
  readonly declaration: DeclarationTarget;
  readonly declaredType: CapturedFact<TyId | null>;
  readonly inferredTypeBound: CapturedFact<TyId | InferredStorageBound> | null;
  readonly initializer: BodyId | null;
}

export interface CheckedPatternVariable extends HirCoreCarrier {
  readonly parent: DefId;
  readonly declaredType: CapturedFact<TyId | null>;
}

export interface InferredStorageBound {
  readonly type: TyId;
  readonly alias: DefId;
  readonly sources: readonly LocalId[] | null;
}

export interface InferredStorageCandidate {
  readonly local: LocalRef;
  readonly type: TyId;
  readonly initializer: Expression<CheckedPhase>;
}

export type CollectInferredStorageSources = (
  candidates: readonly InferredStorageCandidate[],
  nodes: Iterable<HirNode>,
  nodeCount: number,
  bodies: readonly HirBody[],
  signatureOf: (signature: SigId) => Signature | null,
  admit: (work: number) => boolean,
) => readonly (readonly LocalId[] | null)[] | null;

export interface EnumValueSource {
  readonly definition: DefId;
  readonly body: BodyId;
}

export interface CheckedEnumMember extends CheckedVariable {
  readonly valueSource: EnumValueSource | null;
}

export interface CheckedEnum extends CheckedDeclaration {
  readonly nominal: DefId;
  readonly members: readonly DefId[];
}

export interface CheckedNamespace extends CheckedDeclaration {
  readonly members: readonly DefId[];
}

export interface CheckedImport extends HirCoreCarrier {
  readonly target: CapturedFact<ImportTarget>;
  readonly bindings: readonly SourceNodeRef[];
}

export interface CheckedExport extends HirCoreCarrier {
  readonly target: CapturedFact<ImportTarget | null>;
}

export interface CheckedExportBinding extends HirCoreCarrier {
  readonly binding: SourceNodeRef;
}

export interface CheckedNamespaceExport extends CheckedExportBinding, CheckedDeclaration {}

export interface CheckedExportAssignment extends CheckedDeclaration {}

export interface CheckedStaticBlock extends CheckedDeclaration {
  readonly body: BodyId;
}

export interface CheckedProperty extends HirCoreCarrier {
  readonly key: CapturedFact<MemberKey>;
  readonly origins: CapturedFact<readonly MemberOrigin[]>;
}

export interface CheckedBinding extends HirCoreCarrier {
  readonly declaration: DeclarationTarget | null;
  readonly declaredType: CapturedFact<TyId | null>;
}

export interface CheckedBindingList extends HirCoreCarrier {
  readonly disposal: readonly CapturedFact<HirProtocolFact>[];
}

export interface CheckedIteration extends HirCoreCarrier {
  readonly protocol: CapturedFact<HirProtocolFact | null>;
}

export interface CheckedModule extends CheckedDeclaration {
  readonly body: BodyId;
}

export interface CheckedTypeParameter extends CheckedDeclaration {
  readonly parameter: TypeParameter;
}

export interface CheckedPhase extends Phase {
  readonly Token: null;
  readonly ParameterInitializer: Expression<CheckedPhase> | null;
  readonly CallArguments: NodeList<Expression<CheckedPhase>>;
  readonly Identifier: CheckedName;
  readonly PrivateIdentifier: CheckedName;
  readonly QualifiedName: CheckedName;
  readonly ComputedPropertyName: CheckedProperty;
  readonly Decorator: null;
  readonly EmptyStatement: null;
  readonly IfStatement: null;
  readonly DoStatement: null;
  readonly WhileStatement: null;
  readonly ForStatement: null;
  readonly ForInOrOfStatement: CheckedIteration;
  readonly BreakStatement: null;
  readonly ContinueStatement: null;
  readonly ReturnStatement: null;
  readonly WithStatement: null;
  readonly SwitchStatement: null;
  readonly CaseBlock: null;
  readonly CaseClause: null;
  readonly ThrowStatement: null;
  readonly TryStatement: null;
  readonly CatchClause: null;
  readonly DebuggerStatement: null;
  readonly LabeledStatement: null;
  readonly ExpressionStatement: null;
  readonly Block: null;
  readonly VariableStatement: null;
  readonly VariableDeclaration: CheckedVariable | CheckedPatternVariable;
  readonly VariableDeclarationList: CheckedBindingList;
  readonly BindingPattern: CheckedBinding;
  readonly ParameterDeclaration: CheckedVariable;
  readonly BindingElement: CheckedBinding;
  readonly MissingDeclaration: null;
  readonly FunctionDeclaration: CheckedCallable;
  readonly ClassDeclaration: CheckedClass;
  readonly ClassExpression: CheckedClassExpression;
  readonly HeritageClause: null;
  readonly InterfaceDeclaration: CheckedClass;
  readonly TypeAliasDeclaration: CheckedTypeAlias;
  readonly EnumMember: CheckedEnumMember;
  readonly EnumDeclaration: CheckedEnum;
  readonly ModuleBlock: null;
  readonly NotEmittedStatement: null;
  readonly NotEmittedTypeElement: null;
  readonly ImportDeclaration: CheckedImport;
  readonly ExternalModuleReference: null;
  readonly NamespaceImport: CheckedImport;
  readonly NamedImports: null;
  readonly ExportAssignment: CheckedExportAssignment;
  readonly NamespaceExportDeclaration: CheckedExportBinding;
  readonly NamespaceExport: CheckedNamespaceExport;
  readonly NamedExports: null;
  readonly ExportSpecifier: CheckedExportBinding;
  readonly CallSignatureDeclaration: CheckedCallable;
  readonly ConstructSignatureDeclaration: CheckedCallable;
  readonly ConstructorDeclaration: CheckedCallable;
  readonly GetAccessorDeclaration: CheckedCallable;
  readonly SetAccessorDeclaration: CheckedCallable;
  readonly IndexSignatureDeclaration: CheckedCallable;
  readonly MethodSignatureDeclaration: CheckedCallable;
  readonly MethodDeclaration: CheckedCallable;
  readonly PropertySignatureDeclaration: CheckedVariable;
  readonly PropertyDeclaration: CheckedVariable;
  readonly SemicolonClassElement: null;
  readonly ClassStaticBlockDeclaration: CheckedStaticBlock;
  readonly OmittedExpression: CheckedExpression;
  readonly KeywordExpression: CheckedKeyword;
  readonly StringLiteral: CheckedLiteral;
  readonly NumericLiteral: CheckedLiteral;
  readonly BigIntLiteral: CheckedLiteral;
  readonly RegularExpressionLiteral: CheckedExpression;
  readonly NoSubstitutionTemplateLiteral: CheckedLiteral;
  readonly BinaryExpression: CheckedBinary;
  readonly PrefixUnaryExpression: CheckedUnary;
  readonly PostfixUnaryExpression: CheckedUnary;
  readonly YieldExpression: CheckedProtocol;
  readonly ArrowFunction: CheckedClosure | CheckedFieldSelector;
  readonly FunctionExpression: CheckedClosure;
  readonly AsExpression: CheckedExpression;
  readonly SatisfiesExpression: CheckedExpression;
  readonly ConditionalExpression: CheckedExpression;
  readonly PropertyAccessExpression: CheckedMember;
  readonly ElementAccessExpression: CheckedMember;
  readonly CallExpression: CheckedApplication;
  readonly NewExpression: CheckedApplication;
  readonly MetaProperty: CheckedExpression;
  readonly NonNullExpression: CheckedExpression;
  readonly SpreadElement: CheckedProtocol;
  readonly TemplateExpression: CheckedExpression;
  readonly TemplateSpan: null;
  readonly TaggedTemplateExpression: CheckedApplication;
  readonly ParenthesizedExpression: CheckedExpression;
  readonly ArrayLiteralExpression: CheckedAggregate;
  readonly ObjectLiteralExpression: CheckedAggregate;
  readonly SpreadAssignment: null;
  readonly PropertyAssignment: CheckedProperty;
  readonly ShorthandPropertyAssignment: CheckedProperty;
  readonly DeleteExpression: CheckedExpression;
  readonly TypeOfExpression: CheckedExpression;
  readonly VoidExpression: CheckedExpression;
  readonly AwaitExpression: CheckedProtocol;
  readonly TypeAssertion: CheckedExpression;
  readonly KeywordTypeNode: CheckedType;
  readonly UnionTypeNode: CheckedType;
  readonly IntersectionTypeNode: CheckedType;
  readonly ConditionalTypeNode: CheckedType;
  readonly TypeOperatorNode: CheckedType;
  readonly InferTypeNode: CheckedType;
  readonly ArrayTypeNode: CheckedType;
  readonly IndexedAccessTypeNode: CheckedType;
  readonly TypeReferenceNode: CheckedType;
  readonly ExpressionWithTypeArguments: CheckedInstantiation;
  readonly LiteralTypeNode: CheckedType;
  readonly ThisTypeNode: CheckedType;
  readonly TypePredicateNode: CheckedType;
  readonly ImportAttribute: CheckedProperty;
  readonly ImportAttributes: null;
  readonly TypeQueryNode: CheckedType;
  readonly MappedTypeNode: CheckedType;
  readonly TypeLiteralNode: CheckedType;
  readonly TupleTypeNode: CheckedType;
  readonly NamedTupleMember: CheckedType;
  readonly OptionalTypeNode: CheckedType;
  readonly RestTypeNode: CheckedType;
  readonly ParenthesizedTypeNode: CheckedType;
  readonly FunctionTypeNode: CheckedCallableType;
  readonly ConstructorTypeNode: CheckedCallableType;
  readonly TemplateHead: null;
  readonly TemplateMiddle: null;
  readonly TemplateTail: null;
  readonly TemplateLiteralTypeNode: CheckedType;
  readonly TemplateLiteralTypeSpan: CheckedType;
  readonly PartiallyEmittedExpression: CheckedExpression;
  readonly JsxElement: CheckedExpression;
  readonly JsxAttributes: CheckedExpression;
  readonly JsxNamespacedName: CheckedExpression;
  readonly JsxOpeningElement: CheckedExpression;
  readonly JsxSelfClosingElement: CheckedExpression;
  readonly JsxFragment: CheckedExpression;
  readonly JsxOpeningFragment: CheckedExpression;
  readonly JsxClosingFragment: CheckedExpression;
  readonly JsxAttribute: null;
  readonly JsxSpreadAttribute: null;
  readonly JsxClosingElement: null;
  readonly JsxExpression: CheckedExpression;
  readonly JsxText: CheckedExpression;
  readonly SyntaxList: null;
  readonly JSDoc: null;
  readonly JSDocTypeExpression: CheckedType;
  readonly JSDocNonNullableType: CheckedType;
  readonly JSDocNullableType: CheckedType;
  readonly JSDocAllType: CheckedType;
  readonly JSDocVariadicType: CheckedType;
  readonly JSDocOptionalType: CheckedType;
  readonly JSDocTypeTag: null;
  readonly JSDocUnknownTag: null;
  readonly JSDocTemplateTag: null;
  readonly JSDocReturnTag: null;
  readonly JSDocPublicTag: null;
  readonly JSDocPrivateTag: null;
  readonly JSDocProtectedTag: null;
  readonly JSDocReadonlyTag: null;
  readonly JSDocOverrideTag: null;
  readonly JSDocDeprecatedTag: null;
  readonly JSDocSeeTag: null;
  readonly JSDocImplementsTag: null;
  readonly JSDocAugmentsTag: null;
  readonly JSDocSatisfiesTag: null;
  readonly JSDocThrowsTag: null;
  readonly JSDocThisTag: null;
  readonly JSDocImportTag: null;
  readonly JSDocCallbackTag: null;
  readonly JSDocOverloadTag: null;
  readonly JSDocTypedefTag: null;
  readonly JSDocSignature: CheckedType;
  readonly JSDocNameReference: CheckedType;
  readonly SourceFile: CheckedModule;
  readonly ModuleDeclaration: CheckedNamespace;
  readonly ImportEqualsDeclaration: CheckedImport;
  readonly ExportDeclaration: CheckedExport;
  readonly ImportTypeNode: CheckedType;
  readonly ImportClause: CheckedImport;
  readonly ImportSpecifier: CheckedImport;
  readonly JSDocText: null;
  readonly JSDocLink: null;
  readonly JSDocLinkPlain: null;
  readonly JSDocLinkCode: null;
  readonly TypeParameterDeclaration: CheckedTypeParameter;
  readonly SyntheticReferenceExpression: CheckedExpression;
  readonly JSDocTypeLiteral: CheckedType;
  readonly JSDocParameterOrPropertyTag: null;
}

export type HirNode = SyntaxNode<CheckedPhase>;

export type CheckedGroupingFrontierOf = (node: HirNode) => boolean;

export interface HirLocal {
  readonly id: LocalId;
  readonly declaration: SourceNodeRef;
  readonly name: string;
  readonly role: "parameter" | "binding" | "capture" | "catch";
  readonly checkerSlot: CapturedFact<TyId>;
  readonly capturedFrom: LocalRef | null;
  readonly mutable: boolean;
}

export interface HirParam {
  readonly local: LocalId;
  readonly declaration: DefId;
  readonly role: "required" | "optional" | "default" | "rest" | "this";
  readonly passing: PassingMode;
  readonly initializer: BodyId | null;
}

export interface HirLexicalScope {
  readonly node: NodeId;
  readonly parent: NodeId | null;
  readonly attributes: readonly HirAttribute[];
}

export interface HirBody {
  readonly body: BodyId;
  readonly owner: DefId;
  readonly params: readonly HirParam[];
  readonly locals: readonly HirLocal[];
  readonly root: BodyRoot<CheckedPhase>;
  readonly captures: readonly LocalRef[];
  readonly scopes: readonly HirLexicalScope[];
  readonly asynchronous: boolean;
  readonly generator: boolean;
  readonly candidateLists: readonly HirCandidateList[];
  readonly nestedBodies: readonly BodyId[];
}

export interface HirDeclarationEntry {
  readonly definition: DefId;
  readonly node: NodeId;
}

export type CheckedParameterHeadersOf = (callable: HirNode, body: HirBody,
  definitionAt: (node: NodeId) => DefId | undefined) => readonly ParameterDeclaration<CheckedPhase>[] | null;

export type DeclarationKind = "VariableDeclaration" | "Parameter" | "BindingElement" | "MissingDeclaration" | "FunctionDeclaration" | "ClassDeclaration" | "ClassExpression" | "InterfaceDeclaration" | "TypeAliasDeclaration" | "JSTypeAliasDeclaration" | "EnumMember" | "EnumDeclaration" | "ImportDeclaration" | "JSImportDeclaration" | "NamespaceImport" | "ExportAssignment" | "NamespaceExportDeclaration" | "NamespaceExport" | "ExportSpecifier" | "CallSignature" | "ConstructSignature" | "Constructor" | "GetAccessor" | "SetAccessor" | "IndexSignature" | "MethodSignature" | "MethodDeclaration" | "PropertySignature" | "PropertyDeclaration" | "SemicolonClassElement" | "ClassStaticBlockDeclaration" | "NoSubstitutionTemplateLiteral" | "BinaryExpression" | "ArrowFunction" | "FunctionExpression" | "CallExpression" | "ObjectLiteralExpression" | "SpreadAssignment" | "PropertyAssignment" | "ShorthandPropertyAssignment" | "MappedType" | "TypeLiteral" | "NamedTupleMember" | "FunctionType" | "ConstructorType" | "JsxAttributes" | "JsxAttribute" | "JSDocSignature" | "SourceFile" | "ModuleDeclaration" | "ImportEqualsDeclaration" | "ExportDeclaration" | "ImportClause" | "ImportSpecifier" | "TypeParameter" | "JSDocTypeLiteral";

export type ProofObligation =
  | { readonly kind: "write-fit"; readonly ordinal: number; readonly occurrence: NodeRef; readonly value: NodeRef;
      readonly destination: SourceNodeRef; readonly destinationType: TyId }
  | { readonly kind: "operator"; readonly ordinal: number; readonly occurrence: NodeRef; readonly operator: HirUnaryOperator | HirBinaryOperator;
      readonly operands: readonly NodeRef[] }
  | { readonly kind: "index"; readonly ordinal: number; readonly occurrence: NodeRef; readonly receiver: NodeRef; readonly key: NodeRef };

export interface HirDiagnosticRoot {
  readonly diagnostic: number;
  readonly owner: SourceNodeRef;
  readonly obligations: readonly ProofObligation[];
}

export type ModuleEvaluation = "eager" | "erased" | "deferred";

export interface HirModuleLink {
  readonly declaration: NodeId;
  readonly evaluation: ModuleEvaluation;
}

export interface HirModule {
  readonly module: ModuleId;
  readonly tree: SourceFile<CheckedPhase>;
  readonly items: readonly HirDeclarationEntry[];
  readonly bodies: readonly HirBody[];
  readonly exports: readonly HirModuleExport[];
  readonly bindings: readonly HirModuleBinding[];
  readonly moduleLinks: readonly HirModuleLink[];
  readonly checkerDiagnostics: readonly Diagnostic[];
  readonly obligations: readonly HirDiagnosticRoot[];
}

export type HirRule = "core-capture-reference" | "core-capture-kind" | "literal-type-child" | "inferred-type-bound" | "node-in-body-range" | "module-owner" | "definition-unique" | "definition-parent" | "definition-reference" | "ordinal-domain"
  | "body-owner" | "body-unique" | "identity-path-exact" | "node-dense-preorder" | "node-reference" | "lexical-parent"
  | "origin-range" | "local-dense" | "local-reference" | "capture-owner" | "parameter-order"
  | "scope-parent" | "literal-exact" | "type-reference" | "signature-reference" | "candidate-original-order"
  | "candidate-endpoints" | "binding-vector-complete" | "contribution-parameter" | "protocol-kind"
  | "diagnostic-reference" | "diagnostic-root-owner" | "obligation-complete" | "obligation-order" | "stable-order"
  | "cross-owner-qualified" | "candidate-list-dense" | "candidate-list-reference" | "export-type-only-star" | "module-link"
  | "place-base-acyclic" | "place-access-base-in-receiver" | "intrinsic-value-use"
  | "memory-capture-owner" | "memory-capture-reference" | "memory-layout-acyclic" | "observation-capture-owner" | "binding-capture-owner";

export type HirSite =
  | { readonly kind: "module"; readonly module: ModuleId }
  | { readonly kind: "definition"; readonly definition: DefId }
  | { readonly kind: "node"; readonly node: SourceNodeRef }
  | { readonly kind: "body"; readonly body: BodyId };

export type PrintHir = (module: HirModule) => string;
export type ParseHir = (text: string) => TextParseResult<HirModule>;

export type CheckedUnopenedDeclaration =
  | FunctionDeclaration<CheckedPhase> | InterfaceDeclaration<CheckedPhase> | TypeAliasDeclaration<CheckedPhase>;

export interface CheckedWireRequest {
  readonly role: "source-file" | "unopened-declaration" | "expression" | "layout-descriptor" | "layout-selector";
  readonly ordinal: number;
  readonly offset: number;
}

export interface CheckedWireImage {
  readonly sourceFileOf: (ordinal: number) => SourceFile<CheckedPhase> | null;
  readonly declarationOf: (ordinal: number) => CheckedUnopenedDeclaration | null;
  readonly expressionOf: (ordinal: number) => Expression<CheckedPhase> | null;
  readonly layoutDescriptorOf: (ordinal: number) => ObjectLiteralExpression<CheckedPhase> | null;
  readonly layoutSelectorOf: (ordinal: number) => ArrowFunction<CheckedPhase> | null;
}

export interface ParsedCheckedDeclarations {
  readonly end: number;
  readonly finish: (requests: readonly CheckedWireRequest[]) => TextParseResult<ClosedCheckedDeclarations>;
}

export interface ClosedCheckedDeclarations {
  readonly materialize: () => CheckedWireImage;
}

export interface PrintedCheckedDeclarations {
  readonly text: string;
  readonly wireOf: (node: HirNode) => number | undefined;
}

export type ParseCheckedDeclarations = (text: string, offset: number) => TextParseResult<ParsedCheckedDeclarations>;
export type PrintCheckedDeclarations = (roots: readonly HirNode[]) => PrintedCheckedDeclarations;

export interface HirDeclarationScopes {
  readonly module: HirModule;
  readonly bindingScopeOf: (definition: DefId) => BindingScope | null;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
}
export type DeriveDeclarationScopes = (module: HirModule, nodes: readonly HirNode[]) => HirDeclarationScopes;
export interface HirVerificationContext {
  readonly moduleOf: (module: ModuleId) => HirModule | null;
  readonly types: TypeTable;
  readonly bodyPathOf: (body: BodyId) => BodyPath | null;
  readonly definitionPathOf: (definition: DefId) => DefinitionPath | null;
  readonly bindingScopeOf: (definition: DefId) => BindingScope | null;
  readonly bindingScopeAt: (node: SourceNodeRef) => BindingScope | null;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly nodeOf: (node: SourceNodeRef) => HirNode | null;
  readonly localExists: (local: LocalRef) => boolean;
}
export type VerifyHir = (module: HirModule, context: HirVerificationContext) => readonly Violation<HirRule, HirSite>[];
export type OrdinarySyntaxPhase<P extends Phase> = Phase & {
  readonly ParameterInitializer: Expression<P> | null;
  readonly CallArguments: NodeList<Expression<P>>;
};

export type WalkSyntaxTree = <P extends OrdinarySyntaxPhase<P>>(
  root: SyntaxNode<P>,
  stopBefore: readonly NodeId[],
) => readonly SyntaxNode<P>[];

export type IndexSyntaxTree = <P extends OrdinarySyntaxPhase<P>>(
  root: SourceFile<P>,
) => readonly SyntaxNode<P>[];

export type UnparenthesizedExpression = <P extends Phase>(node: Expression<P>) => Expression<P>;

export type CheckedContextualTupleAssertionOf = <Stop extends object>(
  node: AsExpression<CheckedPhase> | TypeAssertion<CheckedPhase>,
  isTuple: (type: TyId) => boolean,
  admit: () => Stop | null,
) => { readonly kind: "complete"; readonly value: { readonly product: TyId; readonly literal: NodeId } | null }
  | { readonly kind: "resource-stop"; readonly stop: Stop };

export type ChildrenOfSyntax = <P extends OrdinarySyntaxPhase<P>>(
  node: SyntaxNode<P>,
) => readonly SyntaxNode<P>[];

export type IterateChildrenOfSyntax = <P extends OrdinarySyntaxPhase<P>>(
  node: SyntaxNode<P>,
) => Generator<SyntaxNode<P>, void, undefined>;

export interface SyntaxChild<P extends Phase> {
  readonly node: SyntaxNode<P>;
  readonly fields: readonly (string | number)[];
}

export type IterateSyntaxChildEdges = <P extends OrdinarySyntaxPhase<P>>(node: SyntaxNode<P>) => Generator<SyntaxChild<P>, void, undefined>;

export interface SyntaxChildSlot<P extends Phase> {
  readonly fields: readonly (string | number)[];
  readonly read: () => SyntaxNode<P>;
}

export type IterateSyntaxChildSlots = <P extends Phase, Slot>(node: SyntaxNode<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot,
  initializer: (node: ParameterDeclaration<P>, field: "initializer") => Iterable<Slot>,
  argumentsOf: (node: CallExpression<P>, field: "arguments") => Iterable<Slot>) => Iterable<Slot>;

export type IterateSourceFileHeaderSlots = <P extends Phase, Slot>(node: SourceFileHeader<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, statements: (field: "statements") => Iterable<Slot>) => Iterable<Slot>;

export type IterateParameterHeaderSlots = <P extends Phase, Slot>(node: ParameterDeclaration<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, initializer: (field: "initializer") => Iterable<Slot>) => Iterable<Slot>;

export type IterateFunctionHeaderSlots = <P extends Phase, Slot>(node: FunctionDeclarationHeader<P> | FunctionExpression<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, parameters: (field: "parameters") => Iterable<Slot>,
  body: (field: "body") => Iterable<Slot>) => Iterable<Slot>;

export interface PreparedSourceFileHeader<P extends Phase, Slot> {
  readonly slots: Iterable<Slot>;
  readonly finish: <Statements>(statements: Statements, endOfFile: (value: EndOfFile<P>) => EndOfFile<P>) =>
    SourceFileFields<P> & { readonly statements: Statements };
}

export interface PreparedFunctionHeader<P extends Phase, Slot> {
  readonly slots: Iterable<Slot>;
  readonly finish: <Formals, Body>(parameters: Formals, body: Body,
    modifier: (value: ModifierLike<P>) => ModifierLike<P>, parameter: (value: TypeParameterDeclaration<P>) => TypeParameterDeclaration<P>,
    type: (value: TypeNode<P>) => TypeNode<P>, name: (value: Identifier<P>) => Identifier<P>,
    asterisk: (value: AsteriskToken<P>) => AsteriskToken<P>) =>
    FunctionDeclarationFields<P> & { readonly parameters: Formals; readonly body: Body };
}

export type PrepareSourceFileHeader = <P extends Phase, Slot>(node: SourceFileHeader<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, statements: (field: "statements") => Iterable<Slot>) =>
  PreparedSourceFileHeader<P, Slot>;

export type PrepareFunctionHeader = <P extends Phase, Slot, Stop>(node: FunctionDeclarationFields<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, parameters: (field: "parameters") => Iterable<Slot>,
  body: (field: "body") => Iterable<Slot>, admitList: (field: "modifiers" | "typeParameters" | "parameters") => Stop | null) =>
  SyntaxCopyResult<PreparedFunctionHeader<P, Slot>, Stop>;

export interface BlockSyntaxReceipt<P extends Phase> {
  readonly kind: "block";
  readonly ordinal: number;
  readonly header: NodeHeader;
  readonly multiLine: boolean;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly statements: (read: (node: Statement<P>) => Statement<P>) => NodeList<Statement<P>>;
}

export interface BinarySyntaxReceipt<P extends Phase> {
  readonly kind: "binary";
  readonly ordinal: number;
  readonly header: NodeHeader;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly modifiers: (read: (node: ModifierLike<P>) => ModifierLike<P>) => ModifierList<P> | null;
  readonly left: () => Expression<P>;
  readonly type: () => TypeNode<P> | null;
  readonly operator: () => BinaryOperatorToken<P>;
  readonly right: () => Expression<P>;
}

export type SingleExpressionSyntax<P extends Phase> = AwaitExpression<P> | ComputedPropertyName<P> | DeleteExpression<P>
  | ExpressionStatement<P> | ExternalModuleReference<P> | JsxSpreadAttribute<P> | NonNullExpression<P>
  | ParenthesizedExpression<P> | PartiallyEmittedExpression<P> | SpreadAssignment<P> | SpreadElement<P>
  | ThrowStatement<P> | TypeOfExpression<P> | VoidExpression<P>;

export interface SingleExpressionReceipt<P extends Phase> {
  readonly kind: "single-expression";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly expression: () => Expression<P>;
}

export interface ReturnSyntaxReceipt<P extends Phase> {
  readonly kind: "return";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly expression: () => Expression<P> | null;
}

export type UnarySyntax<P extends Phase> = PrefixUnaryExpression<P> | PostfixUnaryExpression<P>;
export type AnnotatedExpressionSyntax<P extends Phase> = AsExpression<P> | SatisfiesExpression<P>;

export interface UnarySyntaxReceipt<P extends Phase> {
  readonly kind: "unary";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly operand: () => Expression<P>;
}

export interface AnnotatedExpressionSyntaxReceipt<P extends Phase> {
  readonly kind: "annotated-expression";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly expression: () => Expression<P>;
  readonly type: () => TypeNode<P>;
}

export interface ConditionalSyntaxReceipt<P extends Phase> {
  readonly kind: "conditional";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly condition: () => Expression<P>;
  readonly question: () => QuestionToken<P>;
  readonly whenTrue: () => Expression<P>;
  readonly colon: () => ColonToken<P>;
  readonly whenFalse: () => Expression<P>;
}

export interface IfSyntaxReceipt<P extends Phase> {
  readonly kind: "if";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly expression: () => Expression<P>;
  readonly thenStatement: () => Statement<P>;
  readonly elseStatement: () => Statement<P> | null;
}

export interface AccessSyntaxFields<P extends Phase> {
  readonly expression: () => Expression<P>;
  readonly questionDotToken: () => QuestionDotToken<P> | null;
}

export interface PropertySyntaxReceipt<P extends Phase> extends AccessSyntaxFields<P> {
  readonly kind: "property-access";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly name: () => MemberName<P>;
}

export interface ElementSyntaxReceipt<P extends Phase> extends AccessSyntaxFields<P> {
  readonly kind: "element-access";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly argument: () => Expression<P>;
}

export interface ArraySyntaxReceipt<P extends Phase> {
  readonly kind: "array-literal";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly elements: (read: (node: Expression<P>) => Expression<P>) => NodeList<Expression<P>>;
}

export interface ObjectSyntaxReceipt<P extends Phase> {
  readonly kind: "object-literal";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly properties: (read: (node: ObjectLiteralElementLike<P>) => ObjectLiteralElementLike<P>) => NodeList<ObjectLiteralElementLike<P>>;
}

export interface VariableStatementSyntaxReceipt<P extends Phase> {
  readonly kind: "variable-statement";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly modifiers: (read: (node: ModifierLike<P>) => ModifierLike<P>) => ModifierList<P> | null;
  readonly declarationList: () => VariableDeclarationList<P>;
}

export interface VariableDeclarationSyntaxFields<P extends Phase> {
  readonly name: () => BindingName<P>;
  readonly exclamationToken: () => ExclamationToken<P> | null;
  readonly type: () => TypeNode<P> | null;
  readonly initializer: () => Expression<P> | null;
}

export interface VariableDeclarationSyntaxReceipt<P extends Phase> extends VariableDeclarationSyntaxFields<P> {
  readonly kind: "variable-declaration";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
}

export interface VariableListSyntaxReceipt<P extends Phase> {
  readonly kind: "variable-list";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly declarations: (read: (node: VariableDeclaration<P>) => VariableDeclaration<P>) => NodeList<VariableDeclaration<P>>;
}

export interface BindingPatternSyntaxReceipt<P extends Phase> {
  readonly kind: "binding-pattern";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly elements: (read: (node: BindingElement<P>) => BindingElement<P>) => NodeList<BindingElement<P>>;
}

export interface BindingElementSyntaxFields<P extends Phase> {
  readonly dotDotDotToken: () => DotDotDotToken<P> | null;
  readonly propertyName: () => PropertyName<P> | null;
  readonly name: () => BindingName<P> | null;
  readonly initializer: () => Expression<P> | null;
}

export interface BindingElementSyntaxReceipt<P extends Phase> extends BindingElementSyntaxFields<P> {
  readonly kind: "binding-element";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
}

export type ControlSyntax<P extends Phase> = DoStatement<P> | WhileStatement<P> | WithStatement<P>
  | ForStatement<P> | ForInOrOfStatement<P> | BreakStatement<P> | ContinueStatement<P>
  | SwitchStatement<P> | CaseBlock<P> | CaseOrDefaultClause<P> | TryStatement<P> | CatchClause<P> | LabeledStatement<P>;

export type ControlSyntaxReceipt<P extends Phase> = {
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
} & (
  | { readonly kind: "tested-statement"; readonly statement: () => Statement<P>; readonly expression: () => Expression<P> }
  | { readonly kind: "for"; readonly initializer: () => ForInitializer<P> | null; readonly condition: () => Expression<P> | null;
      readonly incrementor: () => Expression<P> | null; readonly statement: () => Statement<P> }
  | { readonly kind: "for-in-or-of"; readonly awaitModifier: () => AwaitKeyword<P> | null;
      readonly initializer: () => ForInitializer<P>; readonly expression: () => Expression<P>; readonly statement: () => Statement<P> }
  | { readonly kind: "jump"; readonly label: () => Identifier<P> | null }
  | { readonly kind: "switch"; readonly expression: () => Expression<P>; readonly caseBlock: () => CaseBlock<P> }
  | { readonly kind: "case-block"; readonly clauses: (read: (node: CaseOrDefaultClause<P>) => CaseOrDefaultClause<P>) =>
      NodeList<CaseOrDefaultClause<P>> }
  | { readonly kind: "case-clause"; readonly expression: () => Expression<P> | null;
      readonly statements: (read: (node: Statement<P>) => Statement<P>) => NodeList<Statement<P>> }
  | { readonly kind: "try"; readonly tryBlock: () => Block<P>; readonly catchClause: () => CatchClause<P> | null;
      readonly finallyBlock: () => Block<P> | null }
  | { readonly kind: "catch"; readonly variableDeclaration: () => VariableDeclaration<P> | null; readonly block: () => Block<P> }
  | { readonly kind: "labeled"; readonly label: () => Identifier<P>; readonly statement: () => Statement<P> }
);

export type DeclarationStructureSyntax<P extends Phase> = ClassDeclaration<P> | ClassExpression<P> | InterfaceDeclaration<P>
  | HeritageClause<P> | TypeAliasDeclaration<P> | EnumDeclaration<P> | EnumMember<P> | ModuleBlock<P> | MissingDeclaration<P>
  | CallSignatureDeclaration<P> | ConstructSignatureDeclaration<P> | ConstructorDeclaration<P> | GetAccessorDeclaration<P>
  | SetAccessorDeclaration<P> | IndexSignatureDeclaration<P> | MethodSignatureDeclaration<P> | MethodDeclaration<P>
  | PropertySignatureDeclaration<P> | PropertyDeclaration<P> | ClassStaticBlockDeclaration<P> | JSDocSignature<P>;

export interface ModifiedSyntaxFields<P extends Phase> {
  readonly modifiers: (read: (value: ModifierLike<P>) => ModifierLike<P>) => ModifierList<P> | null;
}

export interface TypeParametersSyntaxFields<P extends Phase> {
  readonly typeParameters: (read: (value: TypeParameterDeclaration<P>) => TypeParameterDeclaration<P>) =>
    NodeList<TypeParameterDeclaration<P>> | null;
}

export interface AggregateSyntaxFields<P extends Phase> extends ModifiedSyntaxFields<P>, TypeParametersSyntaxFields<P> {
  readonly heritageClauses: (read: (value: HeritageClause<P>) => HeritageClause<P>) => NodeList<HeritageClause<P>> | null;
}

export type DeclarationStructureReceipt<P extends Phase> = {
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
} & (
  | ({ readonly kind: "class"; readonly name: () => Identifier<P> | null;
      readonly members: (read: (value: ClassElement<P>) => ClassElement<P>) => NodeList<ClassElement<P>> } & AggregateSyntaxFields<P>)
  | ({ readonly kind: "interface"; readonly name: () => Identifier<P>;
      readonly members: (read: (value: TypeElement<P>) => TypeElement<P>) => NodeList<TypeElement<P>> } & AggregateSyntaxFields<P>)
  | { readonly kind: "heritage"; readonly types: (read: (value: ExpressionWithTypeArguments<P>) => ExpressionWithTypeArguments<P>) =>
      NodeList<ExpressionWithTypeArguments<P>> }
  | ({ readonly kind: "type-alias"; readonly name: () => Identifier<P>; readonly type: () => TypeNode<P> }
      & ModifiedSyntaxFields<P> & TypeParametersSyntaxFields<P>)
  | ({ readonly kind: "enum"; readonly name: () => Identifier<P>;
      readonly members: (read: (value: EnumMember<P>) => EnumMember<P>) => NodeList<EnumMember<P>> } & ModifiedSyntaxFields<P>)
  | ({ readonly kind: "enum-member"; readonly name: () => PropertyName<P>; readonly postfix: () => QuestionToken<P> | ExclamationToken<P> | null;
      readonly initializer: () => Expression<P> | null } & ModifiedSyntaxFields<P>)
  | { readonly kind: "module-block"; readonly statements: (read: (value: Statement<P>) => Statement<P>) => NodeList<Statement<P>> }
  | ({ readonly kind: "missing-declaration" } & ModifiedSyntaxFields<P>)
  | ({ readonly kind: "bare-signature" } & SignatureSyntaxFields<P>)
  | ({ readonly kind: "modified-signature" } & CallableSyntaxFields<P>)
  | ({ readonly kind: "constructor"; readonly asterisk: () => AsteriskToken<P> | null;
      readonly body: () => BlockOrExpression<P> | null } & CallableSyntaxFields<P>)
  | ({ readonly kind: "method"; readonly asterisk: () => AsteriskToken<P> | null;
      readonly body: () => BlockOrExpression<P> | null } & CallableSyntaxFields<P> & MemberNameSyntaxFields<P>)
  | ({ readonly kind: "method-signature" } & CallableSyntaxFields<P> & MemberNameSyntaxFields<P>)
  | ({ readonly kind: "property-member"; readonly type: () => TypeNode<P> | null;
      readonly initializer: () => Expression<P> | null } & MemberNameSyntaxFields<P> & ModifiedSyntaxFields<P>)
  | ({ readonly kind: "static-block"; readonly body: () => Block<P> } & ModifiedSyntaxFields<P>)
);

export type WrappedTypeSyntax<P extends Phase> = TypeOperatorNode<P> | OptionalTypeNode<P> | RestTypeNode<P> | ParenthesizedTypeNode<P>
  | JSDocTypeExpression<P> | JSDocNonNullableType<P> | JSDocNullableType<P> | JSDocVariadicType<P> | JSDocOptionalType<P>;
export type TypeStructureSyntax<P extends Phase> = WrappedTypeSyntax<P> | ArrayTypeNode<P> | UnionTypeNode<P> | IntersectionTypeNode<P>
  | TupleTypeNode<P> | TypeLiteralNode<P> | ConditionalTypeNode<P> | IndexedAccessTypeNode<P> | TypeReferenceNode<P> | TypeQueryNode<P>
  | LiteralTypeNode<P> | InferTypeNode<P> | NamedTupleMember<P> | TypePredicateNode<P> | MappedTypeNode<P> | TypeParameterDeclaration<P>
  | ImportAttribute<P> | ImportAttributes<P> | FunctionTypeNode<P> | ConstructorTypeNode<P> | TemplateLiteralTypeNode<P> | TemplateLiteralTypeSpan<P>;

export type TypeStructureReceipt<P extends Phase> = {
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
} & (
  | { readonly kind: "type-wrapper"; readonly value: () => TypeNode<P> }
  | { readonly kind: "type-vector"; readonly values: (read: (node: TypeNode<P>) => TypeNode<P>) => NodeList<TypeNode<P>> }
  | { readonly kind: "type-members"; readonly members: (read: (node: TypeElement<P>) => TypeElement<P>) => NodeList<TypeElement<P>> }
  | { readonly kind: "conditional-type"; readonly check: () => TypeNode<P>; readonly extends: () => TypeNode<P>;
      readonly whenTrue: () => TypeNode<P>; readonly whenFalse: () => TypeNode<P> }
  | { readonly kind: "indexed-type"; readonly object: () => TypeNode<P>; readonly index: () => TypeNode<P> }
  | { readonly kind: "named-type"; readonly name: () => EntityName<P>;
      readonly arguments: (read: (node: TypeNode<P>) => TypeNode<P>) => NodeList<TypeNode<P>> | null }
  | { readonly kind: "literal-type"; readonly literal: () => LiteralTypeChild<P> }
  | { readonly kind: "infer-type"; readonly parameter: () => TypeParameterDeclaration<P> }
  | { readonly kind: "named-tuple"; readonly dots: () => DotDotDotToken<P> | null; readonly name: () => Identifier<P>;
      readonly question: () => QuestionToken<P> | null; readonly type: () => TypeNode<P> }
  | { readonly kind: "type-predicate"; readonly asserts: () => AssertsKeyword<P> | null;
      readonly name: () => TypePredicateParameterName<P>; readonly type: () => TypeNode<P> | null }
  | { readonly kind: "import-attribute"; readonly name: () => ImportAttributeName<P>; readonly value: () => Expression<P> }
  | { readonly kind: "import-attributes"; readonly attributes: (read: (value: ImportAttribute<P>) => ImportAttribute<P>) => NodeList<ImportAttribute<P>> }
  | { readonly kind: "mapped-type"; readonly readonlyToken: () => ReadonlyKeyword<P> | PlusToken<P> | MinusToken<P> | null;
      readonly parameter: () => TypeParameterDeclaration<P>; readonly nameType: () => TypeNode<P> | null;
      readonly question: () => QuestionToken<P> | PlusToken<P> | MinusToken<P> | null; readonly type: () => TypeNode<P> | null;
      readonly members: (read: (value: TypeElement<P>) => TypeElement<P>) => NodeList<TypeElement<P>> | null }
  | ({ readonly kind: "callable-type" } & CallableSyntaxFields<P>)
  | ({ readonly kind: "type-parameter"; readonly name: () => Identifier<P>; readonly constraint: () => TypeNode<P> | null;
      readonly expression: () => Expression<P> | null; readonly defaultType: () => TypeNode<P> | null } & ModifiedSyntaxFields<P>)
  | { readonly kind: "template-type"; readonly head: () => TemplateHead<P>;
      readonly spans: (read: (value: TemplateLiteralTypeSpan<P>) => TemplateLiteralTypeSpan<P>) => NodeList<TemplateLiteralTypeSpan<P>> }
  | { readonly kind: "template-type-span"; readonly type: () => TypeNode<P>; readonly literal: () => TemplateMiddleOrTail<P> }
);

export interface SignatureSyntaxFields<P extends Phase> extends TypeParametersSyntaxFields<P> {
  readonly parameters: (read: (value: ParameterDeclaration<P>) => ParameterDeclaration<P>) => NodeList<ParameterDeclaration<P>>;
  readonly type: () => TypeNode<P> | null;
  readonly full: () => TypeNode<P> | null;
}

export interface CallableSyntaxFields<P extends Phase> extends SignatureSyntaxFields<P>, ModifiedSyntaxFields<P> {}

export type ExpressionStructureSyntax<P extends Phase> = QualifiedName<P> | YieldExpression<P> | ArrowFunction<P>
  | MetaProperty<P> | TemplateExpression<P> | TemplateSpan<P> | TaggedTemplateExpression<P>
  | PropertyAssignment<P> | ShorthandPropertyAssignment<P> | TypeAssertion<P> | ExpressionWithTypeArguments<P> | SyntheticReferenceExpression<P> | Decorator<P>;

export interface MemberNameSyntaxFields<P extends Phase> {
  readonly name: () => PropertyName<P>;
  readonly postfix: () => QuestionToken<P> | ExclamationToken<P> | null;
}

export interface PropertyAssignmentFields<P extends Phase> extends ModifiedSyntaxFields<P>, MemberNameSyntaxFields<P> {
  readonly type: () => TypeNode<P> | null;
}

export type ExpressionStructureReceipt<P extends Phase> = {
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
} & (
  | { readonly kind: "qualified-name"; readonly left: () => EntityName<P>; readonly right: () => Identifier<P> }
  | { readonly kind: "yield"; readonly asterisk: () => AsteriskToken<P> | null; readonly expression: () => Expression<P> | null }
  | ({ readonly kind: "arrow"; readonly asterisk: () => AsteriskToken<P> | null;
      readonly arrow: () => EqualsGreaterThanToken<P>; readonly body: () => BlockOrExpression<P> | null } & CallableSyntaxFields<P>)
  | { readonly kind: "meta-property"; readonly name: () => Identifier<P> }
  | { readonly kind: "template-expression"; readonly head: () => TemplateHead<P>;
      readonly spans: (read: (value: TemplateSpan<P>) => TemplateSpan<P>) => NodeList<TemplateSpan<P>> }
  | { readonly kind: "template-span"; readonly expression: () => Expression<P>; readonly literal: () => TemplateMiddleOrTail<P> }
  | { readonly kind: "tagged-template"; readonly tag: () => Expression<P>; readonly question: () => QuestionDotToken<P> | null;
      readonly args: (read: (value: TypeNode<P>) => TypeNode<P>) => NodeList<TypeNode<P>> | null; readonly template: () => TemplateLiteral<P> }
  | ({ readonly kind: "property-assignment"; readonly initializer: () => Expression<P> } & PropertyAssignmentFields<P>)
  | ({ readonly kind: "shorthand-assignment"; readonly equals: () => EqualsToken<P> | null;
      readonly initializer: () => Expression<P> | null } & PropertyAssignmentFields<P>)
  | { readonly kind: "type-assertion"; readonly type: () => TypeNode<P>; readonly expression: () => Expression<P> }
  | { readonly kind: "expression-type-arguments"; readonly expression: () => Expression<P>;
      readonly args: (read: (value: TypeNode<P>) => TypeNode<P>) => NodeList<TypeNode<P>> | null }
  | { readonly kind: "synthetic-reference"; readonly expression: () => Expression<P>; readonly thisArg: () => Expression<P> }
  | { readonly kind: "decorator"; readonly expression: () => LeftHandSideExpression<P> }
);

export type ModuleStructureSyntax<P extends Phase> = ImportDeclaration<P> | ExportDeclaration<P> | ImportEqualsDeclaration<P>
  | ModuleDeclaration<P> | ImportTypeNode<P> | ImportClause<P> | ImportSpecifier<P> | ExportSpecifier<P>
  | NamespaceImport<P> | NamespaceExport<P> | NamespaceExportDeclaration<P> | NamedImports<P> | NamedExports<P> | ExportAssignment<P>;

export type ModuleStructureReceipt<P extends Phase> = {
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
} & (
  | ({ readonly kind: "import-declaration"; readonly clause: () => ImportClause<P> | null;
      readonly specifier: () => Expression<P>; readonly attributes: () => ImportAttributes<P> | null } & ModifiedSyntaxFields<P>)
  | ({ readonly kind: "export-declaration"; readonly clause: () => NamedExportBindings<P> | null;
      readonly specifier: () => Expression<P> | null; readonly attributes: () => ImportAttributes<P> | null } & ModifiedSyntaxFields<P>)
  | ({ readonly kind: "import-equals"; readonly name: () => Identifier<P>; readonly reference: () => ModuleReference<P> } & ModifiedSyntaxFields<P>)
  | ({ readonly kind: "namespace"; readonly asterisk: () => AsteriskToken<P> | null; readonly name: () => ModuleName<P>;
      readonly body: () => NodeBody<P> | null } & ModifiedSyntaxFields<P>)
  | { readonly kind: "import-type"; readonly argument: () => TypeNode<P>; readonly attributes: () => ImportAttributes<P> | null;
      readonly qualifier: () => EntityName<P> | null;
      readonly args: (read: (value: TypeNode<P>) => TypeNode<P>) => NodeList<TypeNode<P>> | null }
  | { readonly kind: "import-clause"; readonly name: () => Identifier<P> | null; readonly bindings: () => NamedImportBindings<P> | null }
  | { readonly kind: "import-specifier"; readonly property: () => ModuleExportName<P> | null; readonly name: () => Identifier<P> }
  | { readonly kind: "export-specifier"; readonly property: () => ModuleExportName<P> | null; readonly name: () => ModuleExportName<P> }
  | { readonly kind: "namespace-import"; readonly name: () => Identifier<P> }
  | { readonly kind: "namespace-export"; readonly name: () => ModuleExportName<P> }
  | ({ readonly kind: "namespace-export-declaration"; readonly name: () => Identifier<P> } & ModifiedSyntaxFields<P>)
  | { readonly kind: "named-imports"; readonly elements: (read: (value: ImportSpecifier<P>) => ImportSpecifier<P>) => NodeList<ImportSpecifier<P>> }
  | { readonly kind: "named-exports"; readonly elements: (read: (value: ExportSpecifier<P>) => ExportSpecifier<P>) => NodeList<ExportSpecifier<P>> }
  | ({ readonly kind: "export-assignment"; readonly type: () => TypeNode<P> | null; readonly expression: () => Expression<P> } & ModifiedSyntaxFields<P>)
);

export type JsxStructureSyntax<P extends Phase> = JsxElement<P> | JsxAttributes<P> | JsxNamespacedName<P>
  | JsxOpeningElement<P> | JsxSelfClosingElement<P> | JsxFragment<P> | JsxAttribute<P> | JsxClosingElement<P> | JsxExpression<P>;

export type JsxStructureReceipt<P extends Phase> = {
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
} & (
  | { readonly kind: "jsx-element"; readonly opening: () => JsxOpeningElement<P>; readonly closing: () => JsxClosingElement<P>;
      readonly children: (read: (value: JsxChild<P>) => JsxChild<P>) => NodeList<JsxChild<P>> }
  | { readonly kind: "jsx-attributes";
      readonly properties: (read: (value: JsxAttributeLike<P>) => JsxAttributeLike<P>) => NodeList<JsxAttributeLike<P>> }
  | { readonly kind: "jsx-name"; readonly namespace: () => Identifier<P>; readonly name: () => Identifier<P> }
  | { readonly kind: "jsx-opening"; readonly name: () => JsxTagNameExpression<P>; readonly attributes: () => JsxAttributes<P>;
      readonly args: (read: (value: TypeNode<P>) => TypeNode<P>) => NodeList<TypeNode<P>> | null }
  | { readonly kind: "jsx-fragment"; readonly opening: () => JsxOpeningFragment<P>; readonly closing: () => JsxClosingFragment<P>;
      readonly children: (read: (value: JsxChild<P>) => JsxChild<P>) => NodeList<JsxChild<P>> }
  | { readonly kind: "jsx-attribute"; readonly name: () => JsxAttributeName<P>; readonly initializer: () => JsxAttributeValue<P> | null }
  | { readonly kind: "jsx-closing"; readonly name: () => JsxTagNameExpression<P> }
  | { readonly kind: "jsx-expression"; readonly dots: () => DotDotDotToken<P> | null; readonly expression: () => Expression<P> | null }
);

export type DocumentationStructureSyntax<P extends Phase> = SyntaxList<P> | JSDoc<P> | JSDocTag<P>
  | JSDocNameReference<P> | JSDocLink<P> | JSDocLinkPlain<P> | JSDocLinkCode<P> | JSDocTypeLiteral<P>;

export interface DocTagSyntaxFields<P extends Phase> {
  readonly tagName: () => Identifier<P>;
  readonly comment: (read: (value: JSDocComment<P>) => JSDocComment<P>) => NodeList<JSDocComment<P>> | null;
}

export type DocumentationStructureReceipt<P extends Phase> = {
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
} & (
  | { readonly kind: "syntax-list"; readonly children: (read: (value: SyntaxNode<P>) => SyntaxNode<P>) => readonly SyntaxNode<P>[] }
  | { readonly kind: "documentation"; readonly content: (read: (value: JSDocComment<P>) => JSDocComment<P>) => NodeList<JSDocComment<P>>;
      readonly tags: (read: (value: JSDocTag<P>) => JSDocTag<P>) => NodeList<JSDocTag<P>> | null }
  | { readonly kind: "doc-reference"; readonly name: () => EntityName<P> }
  | { readonly kind: "doc-link"; readonly name: () => EntityName<P> | null }
  | { readonly kind: "doc-literal"; readonly tags: (read: (value: JSDocTag<P>) => JSDocTag<P>) => readonly JSDocTag<P>[] | null }
  | ({ readonly kind: "doc-tag" } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-syntax-type-tag"; readonly type: () => SyntaxNode<P> } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-type-tag"; readonly type: () => TypeNode<P> } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-optional-type-tag"; readonly type: () => TypeNode<P> | null } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-template"; readonly constraint: () => SyntaxNode<P>;
      readonly parameters: (read: (value: TypeParameterDeclaration<P>) => TypeParameterDeclaration<P>) => NodeList<TypeParameterDeclaration<P>> } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-see"; readonly name: () => TypeNode<P> } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-heritage"; readonly name: () => ExpressionWithTypeArguments<P> } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-import"; readonly clause: () => ImportClause<P> | null;
      readonly specifier: () => Expression<P>; readonly attributes: () => ImportAttributes<P> | null } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-callback"; readonly type: () => TypeNode<P>; readonly name: () => JSDocFullName<P> | null } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-typedef"; readonly type: () => SyntaxNode<P> | null; readonly name: () => JSDocFullName<P> | null } & DocTagSyntaxFields<P>)
  | ({ readonly kind: "doc-parameter"; readonly name: () => EntityName<P>; readonly type: () => TypeNode<P> | null } & DocTagSyntaxFields<P>)
);

interface ApplicationSyntaxHeader<P extends Phase> {
  readonly kind: "application";
  readonly ordinal: number;
  readonly header: NodeHeader;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly expression: () => Expression<P>;
  readonly questionDotToken: () => QuestionDotToken<P> | null;
  readonly typeArguments: (read: (node: TypeNode<P>) => TypeNode<P>) => NodeList<TypeNode<P>> | null;
}

export type ApplicationSyntaxReceipt<P extends Phase> = ApplicationSyntaxHeader<P> & (
  | { readonly form: "call"; readonly arguments: () => SyntaxCallArguments<P> }
  | { readonly form: "new"; readonly arguments: (read: SyntaxExpressionImage<P>) => NodeList<Expression<P>> | null }
);

export interface SyntaxArgumentListReceipt<P extends Phase> {
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly copy: (read: SyntaxExpressionImage<P>) => NodeList<Expression<P>>;
}

export type PrepareSyntaxArgumentList = <P extends Phase>(value: NodeList<Expression<P>>) => SyntaxArgumentListReceipt<P>;

export interface ParameterSyntaxReceipt<P extends Phase> {
  readonly kind: "formal-header";
  readonly ordinal: number;
  readonly header: NodeHeader;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly modifiers: (read: (node: ModifierLike<P>) => ModifierLike<P>) => ModifierList<P> | null;
  readonly dotDotDotToken: () => DotDotDotToken<P> | null;
  readonly name: () => BindingName<P>;
  readonly questionToken: () => QuestionToken<P> | null;
  readonly type: () => TypeNode<P> | null;
}

export interface SourceFileSyntaxReceipt<P extends Phase> {
  readonly kind: "source-header";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly finish: (statement: (value: Statement<P>) => Statement<P>) =>
    SourceFileFields<P> & { readonly statements: NodeList<Statement<P>> };
}

export interface FunctionSyntaxReceipt<P extends Phase> {
  readonly kind: "function-header";
  readonly ordinal: number;
  readonly slots: Iterable<SyntaxChildSlot<P>>;
  readonly finish: (formal: (value: ParameterDeclaration<P>) => ParameterDeclaration<P>,
    body: (value: BlockOrExpression<P>) => BlockOrExpression<P>, modifier: (value: ModifierLike<P>) => ModifierLike<P>,
    typeParameter: (value: TypeParameterDeclaration<P>) => TypeParameterDeclaration<P>, type: (value: TypeNode<P>) => TypeNode<P>,
    name: (value: Identifier<P>) => Identifier<P>) => FunctionDeclarationFields<P> &
    { readonly parameters: NodeList<ParameterDeclaration<P>>; readonly body: BlockOrExpression<P> | null };
}

export type RetainedSyntaxNode<P extends Phase> = Block<P> | BinaryExpression<P> | ReturnStatement<P> | SingleExpressionSyntax<P>
  | CallOrNewExpression<P> | ParameterDeclaration<P> | SourceFile<P> | FunctionDeclaration<P> | FunctionExpression<P>
  | UnarySyntax<P> | AnnotatedExpressionSyntax<P> | ConditionalExpression<P> | IfStatement<P>
  | PropertyAccessExpression<P> | ElementAccessExpression<P> | ArrayLiteralExpression<P> | ObjectLiteralExpression<P>
  | VariableStatement<P> | VariableDeclaration<P> | VariableDeclarationList<P> | BindingPattern<P> | BindingElement<P> | ControlSyntax<P>
  | DeclarationStructureSyntax<P> | TypeStructureSyntax<P> | ExpressionStructureSyntax<P> | ModuleStructureSyntax<P> | JsxStructureSyntax<P>
  | DocumentationStructureSyntax<P>;
export type SyntaxStructureReceipt<P extends Phase> = BlockSyntaxReceipt<P> | BinarySyntaxReceipt<P> | ReturnSyntaxReceipt<P>
  | SingleExpressionReceipt<P> | ApplicationSyntaxReceipt<P> | ParameterSyntaxReceipt<P> | SourceFileSyntaxReceipt<P> | FunctionSyntaxReceipt<P>
  | UnarySyntaxReceipt<P> | AnnotatedExpressionSyntaxReceipt<P> | ConditionalSyntaxReceipt<P> | IfSyntaxReceipt<P>
  | PropertySyntaxReceipt<P> | ElementSyntaxReceipt<P> | ArraySyntaxReceipt<P> | ObjectSyntaxReceipt<P>
  | VariableStatementSyntaxReceipt<P> | VariableDeclarationSyntaxReceipt<P> | VariableListSyntaxReceipt<P>
  | BindingPatternSyntaxReceipt<P> | BindingElementSyntaxReceipt<P> | ControlSyntaxReceipt<P> | DeclarationStructureReceipt<P>
  | TypeStructureReceipt<P> | ExpressionStructureReceipt<P> | ModuleStructureReceipt<P> | JsxStructureReceipt<P> | DocumentationStructureReceipt<P>;
export type SyntaxChildListField = "modifiers" | "typeParameters" | "parameters" | "typeArguments" | "arguments" | "statements"
  | "elements" | "properties" | "declarations" | "clauses" | "types" | "members" | "heritageClauses" | "attributes" | "templateSpans" | "children"
  | "comment" | "tags" | "jsDocPropertyTags";
export type PrepareSyntaxStructure = <P extends Phase, Stop>(
  node: SyntaxNode<P>, ordinal: number, reserve: (node: RetainedSyntaxNode<P>) => Stop | null,
  admitList: (node: RetainedSyntaxNode<P>, field: SyntaxChildListField) => Stop | null,
) => SyntaxCopyResult<SyntaxStructureReceipt<P> | null, Stop>;

export interface SyntaxRootSlot<P extends Phase> {
  readonly path: string;
  readonly read: () => SyntaxNode<P>;
}

export interface SyntaxForest<P extends Phase> {
  readonly nodes: () => Iterable<SyntaxNode<P>>;
  readonly wireOf: (node: SyntaxNode<P>) => number | undefined;
  readonly firstRootSize: number;
  readonly copy: <Stop, Image>(start: () => SyntaxCopyResult<SyntaxPhaseCopy<P, Stop, Image>, Stop>,
    beforeNode: (node: SyntaxNode<P>) => Stop | null, image: Image) => SyntaxCopyResult<SyntaxImage<P>, Stop>;
}


export type SyntaxCopyResult<Value, Stop> =
  | { readonly kind: "copied"; readonly value: Value }
  | { readonly kind: "refused"; readonly stop: Stop };

export type PreparedSyntaxSlot<Value, Image> = (image: Image) => Value;

export interface SyntaxPhaseCopy<P extends Phase, Stop, Image> {
  readonly ArrayLiteralExpression: (value: P["ArrayLiteralExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ArrayLiteralExpression"], Image>, Stop>;
  readonly ArrayTypeNode: (value: P["ArrayTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ArrayTypeNode"], Image>, Stop>;
  readonly ArrowFunction: (value: P["ArrowFunction"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ArrowFunction"], Image>, Stop>;
  readonly AsExpression: (value: P["AsExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["AsExpression"], Image>, Stop>;
  readonly AwaitExpression: (value: P["AwaitExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["AwaitExpression"], Image>, Stop>;
  readonly BigIntLiteral: (value: P["BigIntLiteral"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["BigIntLiteral"], Image>, Stop>;
  readonly BinaryExpression: (value: P["BinaryExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["BinaryExpression"], Image>, Stop>;
  readonly BindingElement: (value: P["BindingElement"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["BindingElement"], Image>, Stop>;
  readonly BindingPattern: (value: P["BindingPattern"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["BindingPattern"], Image>, Stop>;
  readonly CallExpression: (value: P["CallExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["CallExpression"], Image>, Stop>;
  readonly CallSignatureDeclaration: (value: P["CallSignatureDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["CallSignatureDeclaration"], Image>, Stop>;
  readonly CaseClause: (value: P["CaseClause"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["CaseClause"], Image>, Stop>;
  readonly ClassDeclaration: (value: P["ClassDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ClassDeclaration"], Image>, Stop>;
  readonly ClassExpression: (value: P["ClassExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ClassExpression"], Image>, Stop>;
  readonly ClassStaticBlockDeclaration: (value: P["ClassStaticBlockDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ClassStaticBlockDeclaration"], Image>, Stop>;
  readonly ComputedPropertyName: (value: P["ComputedPropertyName"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ComputedPropertyName"], Image>, Stop>;
  readonly ConditionalExpression: (value: P["ConditionalExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ConditionalExpression"], Image>, Stop>;
  readonly ConditionalTypeNode: (value: P["ConditionalTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ConditionalTypeNode"], Image>, Stop>;
  readonly ConstructSignatureDeclaration: (value: P["ConstructSignatureDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ConstructSignatureDeclaration"], Image>, Stop>;
  readonly ConstructorDeclaration: (value: P["ConstructorDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ConstructorDeclaration"], Image>, Stop>;
  readonly ConstructorTypeNode: (value: P["ConstructorTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ConstructorTypeNode"], Image>, Stop>;
  readonly Decorator: (value: P["Decorator"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["Decorator"], Image>, Stop>;
  readonly DeleteExpression: (value: P["DeleteExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["DeleteExpression"], Image>, Stop>;
  readonly ElementAccessExpression: (value: P["ElementAccessExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ElementAccessExpression"], Image>, Stop>;
  readonly EnumDeclaration: (value: P["EnumDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["EnumDeclaration"], Image>, Stop>;
  readonly EnumMember: (value: P["EnumMember"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["EnumMember"], Image>, Stop>;
  readonly ExportAssignment: (value: P["ExportAssignment"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ExportAssignment"], Image>, Stop>;
  readonly ExportDeclaration: (value: P["ExportDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ExportDeclaration"], Image>, Stop>;
  readonly ExportSpecifier: (value: P["ExportSpecifier"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ExportSpecifier"], Image>, Stop>;
  readonly ExpressionWithTypeArguments: (value: P["ExpressionWithTypeArguments"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ExpressionWithTypeArguments"], Image>, Stop>;
  readonly ForInOrOfStatement: (value: P["ForInOrOfStatement"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ForInOrOfStatement"], Image>, Stop>;
  readonly FunctionDeclaration: (value: P["FunctionDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["FunctionDeclaration"], Image>, Stop>;
  readonly FunctionExpression: (value: P["FunctionExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["FunctionExpression"], Image>, Stop>;
  readonly FunctionTypeNode: (value: P["FunctionTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["FunctionTypeNode"], Image>, Stop>;
  readonly GetAccessorDeclaration: (value: P["GetAccessorDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["GetAccessorDeclaration"], Image>, Stop>;
  readonly HeritageClause: (value: P["HeritageClause"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["HeritageClause"], Image>, Stop>;
  readonly Identifier: (value: P["Identifier"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["Identifier"], Image>, Stop>;
  readonly ImportAttribute: (value: P["ImportAttribute"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ImportAttribute"], Image>, Stop>;
  readonly ImportClause: (value: P["ImportClause"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ImportClause"], Image>, Stop>;
  readonly ImportDeclaration: (value: P["ImportDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ImportDeclaration"], Image>, Stop>;
  readonly ImportEqualsDeclaration: (value: P["ImportEqualsDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ImportEqualsDeclaration"], Image>, Stop>;
  readonly ImportSpecifier: (value: P["ImportSpecifier"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ImportSpecifier"], Image>, Stop>;
  readonly ImportTypeNode: (value: P["ImportTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ImportTypeNode"], Image>, Stop>;
  readonly IndexSignatureDeclaration: (value: P["IndexSignatureDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["IndexSignatureDeclaration"], Image>, Stop>;
  readonly IndexedAccessTypeNode: (value: P["IndexedAccessTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["IndexedAccessTypeNode"], Image>, Stop>;
  readonly InferTypeNode: (value: P["InferTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["InferTypeNode"], Image>, Stop>;
  readonly InterfaceDeclaration: (value: P["InterfaceDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["InterfaceDeclaration"], Image>, Stop>;
  readonly IntersectionTypeNode: (value: P["IntersectionTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["IntersectionTypeNode"], Image>, Stop>;
  readonly JSDocAllType: (value: P["JSDocAllType"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocAllType"], Image>, Stop>;
  readonly JSDocNameReference: (value: P["JSDocNameReference"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocNameReference"], Image>, Stop>;
  readonly JSDocNonNullableType: (value: P["JSDocNonNullableType"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocNonNullableType"], Image>, Stop>;
  readonly JSDocNullableType: (value: P["JSDocNullableType"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocNullableType"], Image>, Stop>;
  readonly JSDocOptionalType: (value: P["JSDocOptionalType"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocOptionalType"], Image>, Stop>;
  readonly JSDocSignature: (value: P["JSDocSignature"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocSignature"], Image>, Stop>;
  readonly JSDocTypeExpression: (value: P["JSDocTypeExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocTypeExpression"], Image>, Stop>;
  readonly JSDocTypeLiteral: (value: P["JSDocTypeLiteral"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocTypeLiteral"], Image>, Stop>;
  readonly JSDocVariadicType: (value: P["JSDocVariadicType"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JSDocVariadicType"], Image>, Stop>;
  readonly JsxAttributes: (value: P["JsxAttributes"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxAttributes"], Image>, Stop>;
  readonly JsxClosingFragment: (value: P["JsxClosingFragment"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxClosingFragment"], Image>, Stop>;
  readonly JsxElement: (value: P["JsxElement"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxElement"], Image>, Stop>;
  readonly JsxExpression: (value: P["JsxExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxExpression"], Image>, Stop>;
  readonly JsxFragment: (value: P["JsxFragment"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxFragment"], Image>, Stop>;
  readonly JsxNamespacedName: (value: P["JsxNamespacedName"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxNamespacedName"], Image>, Stop>;
  readonly JsxOpeningElement: (value: P["JsxOpeningElement"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxOpeningElement"], Image>, Stop>;
  readonly JsxOpeningFragment: (value: P["JsxOpeningFragment"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxOpeningFragment"], Image>, Stop>;
  readonly JsxSelfClosingElement: (value: P["JsxSelfClosingElement"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxSelfClosingElement"], Image>, Stop>;
  readonly JsxText: (value: P["JsxText"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["JsxText"], Image>, Stop>;
  readonly KeywordExpression: (value: P["KeywordExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["KeywordExpression"], Image>, Stop>;
  readonly KeywordTypeNode: (value: P["KeywordTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["KeywordTypeNode"], Image>, Stop>;
  readonly LiteralTypeNode: (value: P["LiteralTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["LiteralTypeNode"], Image>, Stop>;
  readonly MappedTypeNode: (value: P["MappedTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["MappedTypeNode"], Image>, Stop>;
  readonly MetaProperty: (value: P["MetaProperty"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["MetaProperty"], Image>, Stop>;
  readonly MethodDeclaration: (value: P["MethodDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["MethodDeclaration"], Image>, Stop>;
  readonly MethodSignatureDeclaration: (value: P["MethodSignatureDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["MethodSignatureDeclaration"], Image>, Stop>;
  readonly ModuleDeclaration: (value: P["ModuleDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ModuleDeclaration"], Image>, Stop>;
  readonly NamedTupleMember: (value: P["NamedTupleMember"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NamedTupleMember"], Image>, Stop>;
  readonly NamespaceExport: (value: P["NamespaceExport"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NamespaceExport"], Image>, Stop>;
  readonly NamespaceExportDeclaration: (value: P["NamespaceExportDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NamespaceExportDeclaration"], Image>, Stop>;
  readonly NamespaceImport: (value: P["NamespaceImport"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NamespaceImport"], Image>, Stop>;
  readonly NewExpression: (value: P["NewExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NewExpression"], Image>, Stop>;
  readonly NoSubstitutionTemplateLiteral: (value: P["NoSubstitutionTemplateLiteral"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NoSubstitutionTemplateLiteral"], Image>, Stop>;
  readonly NonNullExpression: (value: P["NonNullExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NonNullExpression"], Image>, Stop>;
  readonly NumericLiteral: (value: P["NumericLiteral"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["NumericLiteral"], Image>, Stop>;
  readonly ObjectLiteralExpression: (value: P["ObjectLiteralExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ObjectLiteralExpression"], Image>, Stop>;
  readonly OmittedExpression: (value: P["OmittedExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["OmittedExpression"], Image>, Stop>;
  readonly OptionalTypeNode: (value: P["OptionalTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["OptionalTypeNode"], Image>, Stop>;
  readonly ParameterDeclaration: (value: P["ParameterDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ParameterDeclaration"], Image>, Stop>;
  readonly ParenthesizedExpression: (value: P["ParenthesizedExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ParenthesizedExpression"], Image>, Stop>;
  readonly ParenthesizedTypeNode: (value: P["ParenthesizedTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ParenthesizedTypeNode"], Image>, Stop>;
  readonly PartiallyEmittedExpression: (value: P["PartiallyEmittedExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PartiallyEmittedExpression"], Image>, Stop>;
  readonly PostfixUnaryExpression: (value: P["PostfixUnaryExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PostfixUnaryExpression"], Image>, Stop>;
  readonly PrefixUnaryExpression: (value: P["PrefixUnaryExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PrefixUnaryExpression"], Image>, Stop>;
  readonly PrivateIdentifier: (value: P["PrivateIdentifier"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PrivateIdentifier"], Image>, Stop>;
  readonly PropertyAccessExpression: (value: P["PropertyAccessExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PropertyAccessExpression"], Image>, Stop>;
  readonly PropertyAssignment: (value: P["PropertyAssignment"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PropertyAssignment"], Image>, Stop>;
  readonly PropertyDeclaration: (value: P["PropertyDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PropertyDeclaration"], Image>, Stop>;
  readonly PropertySignatureDeclaration: (value: P["PropertySignatureDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["PropertySignatureDeclaration"], Image>, Stop>;
  readonly QualifiedName: (value: P["QualifiedName"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["QualifiedName"], Image>, Stop>;
  readonly RegularExpressionLiteral: (value: P["RegularExpressionLiteral"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["RegularExpressionLiteral"], Image>, Stop>;
  readonly RestTypeNode: (value: P["RestTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["RestTypeNode"], Image>, Stop>;
  readonly SatisfiesExpression: (value: P["SatisfiesExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["SatisfiesExpression"], Image>, Stop>;
  readonly SetAccessorDeclaration: (value: P["SetAccessorDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["SetAccessorDeclaration"], Image>, Stop>;
  readonly ShorthandPropertyAssignment: (value: P["ShorthandPropertyAssignment"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ShorthandPropertyAssignment"], Image>, Stop>;
  readonly SourceFile: (value: P["SourceFile"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["SourceFile"], Image>, Stop>;
  readonly SpreadAssignment: (value: P["SpreadAssignment"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["SpreadAssignment"], Image>, Stop>;
  readonly SpreadElement: (value: P["SpreadElement"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["SpreadElement"], Image>, Stop>;
  readonly StringLiteral: (value: P["StringLiteral"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["StringLiteral"], Image>, Stop>;
  readonly SyntheticReferenceExpression: (value: P["SyntheticReferenceExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["SyntheticReferenceExpression"], Image>, Stop>;
  readonly TaggedTemplateExpression: (value: P["TaggedTemplateExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TaggedTemplateExpression"], Image>, Stop>;
  readonly TemplateExpression: (value: P["TemplateExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TemplateExpression"], Image>, Stop>;
  readonly TemplateLiteralTypeNode: (value: P["TemplateLiteralTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TemplateLiteralTypeNode"], Image>, Stop>;
  readonly TemplateLiteralTypeSpan: (value: P["TemplateLiteralTypeSpan"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TemplateLiteralTypeSpan"], Image>, Stop>;
  readonly ThisTypeNode: (value: P["ThisTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["ThisTypeNode"], Image>, Stop>;
  readonly TupleTypeNode: (value: P["TupleTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TupleTypeNode"], Image>, Stop>;
  readonly TypeAliasDeclaration: (value: P["TypeAliasDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeAliasDeclaration"], Image>, Stop>;
  readonly TypeAssertion: (value: P["TypeAssertion"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeAssertion"], Image>, Stop>;
  readonly TypeLiteralNode: (value: P["TypeLiteralNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeLiteralNode"], Image>, Stop>;
  readonly TypeOfExpression: (value: P["TypeOfExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeOfExpression"], Image>, Stop>;
  readonly TypeOperatorNode: (value: P["TypeOperatorNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeOperatorNode"], Image>, Stop>;
  readonly TypeParameterDeclaration: (value: P["TypeParameterDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeParameterDeclaration"], Image>, Stop>;
  readonly TypePredicateNode: (value: P["TypePredicateNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypePredicateNode"], Image>, Stop>;
  readonly TypeQueryNode: (value: P["TypeQueryNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeQueryNode"], Image>, Stop>;
  readonly TypeReferenceNode: (value: P["TypeReferenceNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["TypeReferenceNode"], Image>, Stop>;
  readonly UnionTypeNode: (value: P["UnionTypeNode"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["UnionTypeNode"], Image>, Stop>;
  readonly VariableDeclaration: (value: P["VariableDeclaration"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["VariableDeclaration"], Image>, Stop>;
  readonly VariableDeclarationList: (value: P["VariableDeclarationList"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["VariableDeclarationList"], Image>, Stop>;
  readonly VoidExpression: (value: P["VoidExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["VoidExpression"], Image>, Stop>;
  readonly YieldExpression: (value: P["YieldExpression"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["YieldExpression"], Image>, Stop>;
}

export interface SyntaxImage<P extends Phase> {
  readonly nodeOf: (node: SyntaxNode<P>) => SyntaxNode<P> | null;
  readonly statementOf: (node: Statement<P>) => Statement<P> | null;
  readonly typeNodeOf: (node: TypeNode<P>) => TypeNode<P> | null;
  readonly modifierOf: (node: ModifierLike<P>) => ModifierLike<P> | null;
  readonly sourceFileOf: (node: SourceFile<P>) => SourceFile<P> | null;
  readonly bodyRootOf: (node: SyntaxNode<P>) => BodyRoot<P> | null;
  readonly parameterOf: (node: ParameterDeclaration<P>) => ParameterDeclaration<P> | null;
}

export type SyntaxExpressionImage<P extends Phase> = (expression: Expression<P>) => Expression<P>;

export type SyntaxInitializerImage<P extends Phase, Image> = (
  parameter: ParameterDeclaration<P>, expression: SyntaxExpressionImage<P>, image: Image,
) => P["ParameterInitializer"];

export type SyntaxCallArgumentsImage<P extends Phase> = (
  call: CallExpression<P>, expression: SyntaxExpressionImage<P>,
) => SyntaxCallArguments<P>;

export interface SyntaxMaterialization<P extends Phase, Image> {
  readonly postorder: Iterable<SyntaxNode<P>>;
  readonly wireOf: (node: SyntaxNode<P>) => number | undefined;
  readonly copyInitializer: SyntaxInitializerImage<P, Image>;
  readonly copyCallArguments: SyntaxCallArgumentsImage<P>;
  readonly structure: (node: RetainedSyntaxNode<P>) => SyntaxStructureReceipt<P>;
}

export type CopySyntaxForest = <Stop, Image>(
  syntax: SyntaxForest<CheckedPhase>, phase: SyntaxPhaseCopy<CheckedPhase, Stop, Image>,
  beforeNode: (node: HirNode) => Stop | null, image: Image,
) => SyntaxCopyResult<SyntaxImage<CheckedPhase>, Stop>;

export type FinishSyntaxCopy<P extends Phase, Stop, Image> = (image: Image) => SyntaxCopyResult<SyntaxImage<P>, Stop>;

export type PrepareSyntaxCopy = <P extends Phase, Stop, Image>(
  phase: SyntaxPhaseCopy<P, Stop, Image>, beforeNode: (node: SyntaxNode<P>) => Stop | null,
  discover: (prepare: (node: SyntaxNode<P>, ordinal: number) => Stop | null) => SyntaxCopyResult<SyntaxMaterialization<P, Image>, Stop>,
) => SyntaxCopyResult<FinishSyntaxCopy<P, Stop, Image>, Stop>;

export interface CheckedProjection<Stop> {
  readonly admit: (work: number, createdRecords: number) => Stop | null;
  readonly syntaxNode: (node: HirNode) => Stop | null;
  readonly type: (type: TyId) => SyntaxCopyResult<TyId, Stop>;
  readonly signature: (signature: SigId) => SyntaxCopyResult<SigId, Stop>;
  readonly bindings: (bindings: BindingVector) => SyntaxCopyResult<BindingVector, Stop>;
  readonly parameter: (parameter: TypeParameter) => SyntaxCopyResult<TypeParameter, Stop>;
  readonly component: (component: TypeComponent) => SyntaxCopyResult<TypeComponent, Stop>;
  readonly core: (capture: HirCoreCapture) => SyntaxCopyResult<HirCoreCapture, Stop>;
}

export interface CheckedModuleImage {
  readonly module: HirModule;
  readonly syntax: SyntaxImage<CheckedPhase>;
}

export interface CheckedContentImage<Stop> {
  readonly syntax: SyntaxImage<CheckedPhase>;
  readonly projectModule: (module: HirModule) => SyntaxCopyResult<CheckedModuleImage, Stop>;
}

export type CopyCheckedContent = <Stop>(
  forest: SyntaxForest<CheckedPhase>, project: CheckedProjection<Stop>,
) => SyntaxCopyResult<CheckedContentImage<Stop>, Stop>;

export type ProjectCheckedContent = <Stop, SupplyStop>(
  candidate: Iterable<SyntaxRootSlot<CheckedPhase>> | null,
  walk: SyntaxWalkAdmission<CheckedPhase, Stop>, project: CheckedProjection<Stop>,
  independent: (candidate: SyntaxImage<CheckedPhase> | null) =>
    SyntaxCopyResult<Iterable<SyntaxRootSlot<CheckedPhase>> | null, Stop | SupplyStop>,
) => SyntaxCopyResult<CheckedContentImage<Stop> | null, Stop | SupplyStop>;

export type CopyCheckedModule = <Stop>(
  module: HirModule, forest: SyntaxForest<CheckedPhase>, project: CheckedProjection<Stop>,
) => SyntaxCopyResult<CheckedModuleImage, Stop>;

export interface SyntaxWalkAdmission<P extends Phase, Stop> {
  readonly root: () => Stop | null;
  readonly edge: () => Stop | null;
  readonly node: (node: SyntaxNode<P>) => Stop | null;
  readonly parameter: (node: ParameterDeclaration<P>) => Stop | null;
  readonly structure: (node: RetainedSyntaxNode<P>) => Stop | null;
  readonly list: (node: RetainedSyntaxNode<P>, field: SyntaxChildListField) => Stop | null;
}

export type WalkSyntaxForest = <P extends OrdinarySyntaxPhase<P>, Stop>(
  roots: Iterable<SyntaxRootSlot<P>>,
  admission: SyntaxWalkAdmission<P, Stop>,
) => { readonly kind: "complete"; readonly value: SyntaxForest<P> } | Stop;

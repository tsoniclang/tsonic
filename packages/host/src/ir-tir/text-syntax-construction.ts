import type { TirNode, TypedPhase } from "./contract.js";
import type { TypeAliasDeclaration, JSDocParameterOrPropertyTag, BindingPattern, ImportDeclaration, KeywordTypeNode, Token, KeywordExpression } from "../ir-hir/contract.js";
import type { AssertsKeyword, AsteriskToken, AwaitKeyword, BinaryOperatorToken, BindingElement, BindingName, Block, BlockOrExpression, BodyRoot, CaseBlock, CaseOrDefaultClause, CatchClause, ClassElement, ColonToken, DotDotDotToken, EndOfFile, EntityName, EnumMember, EqualsGreaterThanToken, EqualsToken, ExclamationToken, ExportSpecifier, Expression, ExpressionWithTypeArguments, ForInitializer, HeritageClause, Identifier, ImportAttribute, ImportAttributeName, ImportAttributes, ImportClause, ImportSpecifier, JSDocComment, JSDocFullName, JSDocTag, JsxAttributeLike, JsxAttributeName, JsxAttributeValue, JsxAttributes, JsxChild, JsxClosingElement, JsxClosingFragment, JsxOpeningElement, JsxOpeningFragment, JsxTagNameExpression, LeftHandSideExpression, LiteralTypeChild, MemberName, ModifierLike, ModuleExportName, ModuleName, ModuleReference, NamedExportBindings, NamedImportBindings, NodeBody, ObjectLiteralElementLike, ParameterDeclaration, PropertyName, QuestionDotToken, QuestionToken, Statement, SyntaxNode, TemplateHead, TemplateLiteral, TemplateLiteralTypeSpan, TemplateMiddleOrTail, TemplateSpan, TypeElement, TypeNode, TypeParameterDeclaration, TypePredicateParameterName, VariableDeclaration, VariableDeclarationList } from "../ir-hir/contract.js";
import type { TirConstruction, TirReader, TirSyntaxConstruction, TirSyntaxFactory } from "./text-construction.js";
import { syntaxReader } from "./text-construction.js";

export const constructTypeAliasDeclaration: TirSyntaxFactory<TypeAliasDeclaration<TypedPhase>> = (kind, make) => {
  switch (kind) {
    case "TypeAliasDeclaration": return { kind, value: make<"TypeAliasDeclaration">(kind) };
    case "JSTypeAliasDeclaration": return { kind, value: make<"JSTypeAliasDeclaration">(kind) };
  }
};

export const constructJSDocParameterOrPropertyTag: TirSyntaxFactory<JSDocParameterOrPropertyTag<TypedPhase>> = (kind, make) => {
  switch (kind) {
    case "JSDocParameterTag": return { kind, value: make<"JSDocParameterTag">(kind) };
    case "JSDocPropertyTag": return { kind, value: make<"JSDocPropertyTag">(kind) };
  }
};

export const constructBindingPattern: TirSyntaxFactory<BindingPattern<TypedPhase>> = (kind, make) => {
  switch (kind) {
    case "ObjectBindingPattern": return { kind, value: make<"ObjectBindingPattern">(kind) };
    case "ArrayBindingPattern": return { kind, value: make<"ArrayBindingPattern">(kind) };
  }
};

export const constructImportDeclaration: TirSyntaxFactory<ImportDeclaration<TypedPhase>> = (kind, make) => {
  switch (kind) {
    case "ImportDeclaration": return { kind, value: make<"ImportDeclaration">(kind) };
    case "JSImportDeclaration": return { kind, value: make<"JSImportDeclaration">(kind) };
  }
};

export const constructKeywordTypeNode: TirSyntaxFactory<KeywordTypeNode<TypedPhase>> = (kind, make) => {
  switch (kind) {
    case "AnyKeyword": return { kind, value: make<"AnyKeyword">(kind) };
    case "BigIntKeyword": return { kind, value: make<"BigIntKeyword">(kind) };
    case "BooleanKeyword": return { kind, value: make<"BooleanKeyword">(kind) };
    case "IntrinsicKeyword": return { kind, value: make<"IntrinsicKeyword">(kind) };
    case "NeverKeyword": return { kind, value: make<"NeverKeyword">(kind) };
    case "NumberKeyword": return { kind, value: make<"NumberKeyword">(kind) };
    case "ObjectKeyword": return { kind, value: make<"ObjectKeyword">(kind) };
    case "StringKeyword": return { kind, value: make<"StringKeyword">(kind) };
    case "SymbolKeyword": return { kind, value: make<"SymbolKeyword">(kind) };
    case "UndefinedKeyword": return { kind, value: make<"UndefinedKeyword">(kind) };
    case "UnknownKeyword": return { kind, value: make<"UnknownKeyword">(kind) };
    case "VoidKeyword": return { kind, value: make<"VoidKeyword">(kind) };
  }
};

export const constructToken: TirSyntaxFactory<Token<TypedPhase>> = (kind, make) => {
  switch (kind) {
    case "Unknown": return { kind, value: make<"Unknown">(kind) };
    case "EndOfFile": return { kind, value: make<"EndOfFile">(kind) };
    case "SingleLineCommentTrivia": return { kind, value: make<"SingleLineCommentTrivia">(kind) };
    case "MultiLineCommentTrivia": return { kind, value: make<"MultiLineCommentTrivia">(kind) };
    case "NewLineTrivia": return { kind, value: make<"NewLineTrivia">(kind) };
    case "WhitespaceTrivia": return { kind, value: make<"WhitespaceTrivia">(kind) };
    case "ConflictMarkerTrivia": return { kind, value: make<"ConflictMarkerTrivia">(kind) };
    case "NonTextFileMarkerTrivia": return { kind, value: make<"NonTextFileMarkerTrivia">(kind) };
    case "JsxTextAllWhiteSpaces": return { kind, value: make<"JsxTextAllWhiteSpaces">(kind) };
    case "OpenBraceToken": return { kind, value: make<"OpenBraceToken">(kind) };
    case "CloseBraceToken": return { kind, value: make<"CloseBraceToken">(kind) };
    case "OpenParenToken": return { kind, value: make<"OpenParenToken">(kind) };
    case "CloseParenToken": return { kind, value: make<"CloseParenToken">(kind) };
    case "OpenBracketToken": return { kind, value: make<"OpenBracketToken">(kind) };
    case "CloseBracketToken": return { kind, value: make<"CloseBracketToken">(kind) };
    case "DotToken": return { kind, value: make<"DotToken">(kind) };
    case "DotDotDotToken": return { kind, value: make<"DotDotDotToken">(kind) };
    case "SemicolonToken": return { kind, value: make<"SemicolonToken">(kind) };
    case "CommaToken": return { kind, value: make<"CommaToken">(kind) };
    case "QuestionDotToken": return { kind, value: make<"QuestionDotToken">(kind) };
    case "LessThanToken": return { kind, value: make<"LessThanToken">(kind) };
    case "LessThanSlashToken": return { kind, value: make<"LessThanSlashToken">(kind) };
    case "GreaterThanToken": return { kind, value: make<"GreaterThanToken">(kind) };
    case "LessThanEqualsToken": return { kind, value: make<"LessThanEqualsToken">(kind) };
    case "GreaterThanEqualsToken": return { kind, value: make<"GreaterThanEqualsToken">(kind) };
    case "EqualsEqualsToken": return { kind, value: make<"EqualsEqualsToken">(kind) };
    case "ExclamationEqualsToken": return { kind, value: make<"ExclamationEqualsToken">(kind) };
    case "EqualsEqualsEqualsToken": return { kind, value: make<"EqualsEqualsEqualsToken">(kind) };
    case "ExclamationEqualsEqualsToken": return { kind, value: make<"ExclamationEqualsEqualsToken">(kind) };
    case "EqualsGreaterThanToken": return { kind, value: make<"EqualsGreaterThanToken">(kind) };
    case "PlusToken": return { kind, value: make<"PlusToken">(kind) };
    case "MinusToken": return { kind, value: make<"MinusToken">(kind) };
    case "AsteriskToken": return { kind, value: make<"AsteriskToken">(kind) };
    case "AsteriskAsteriskToken": return { kind, value: make<"AsteriskAsteriskToken">(kind) };
    case "SlashToken": return { kind, value: make<"SlashToken">(kind) };
    case "PercentToken": return { kind, value: make<"PercentToken">(kind) };
    case "PlusPlusToken": return { kind, value: make<"PlusPlusToken">(kind) };
    case "MinusMinusToken": return { kind, value: make<"MinusMinusToken">(kind) };
    case "LessThanLessThanToken": return { kind, value: make<"LessThanLessThanToken">(kind) };
    case "GreaterThanGreaterThanToken": return { kind, value: make<"GreaterThanGreaterThanToken">(kind) };
    case "GreaterThanGreaterThanGreaterThanToken": return { kind, value: make<"GreaterThanGreaterThanGreaterThanToken">(kind) };
    case "AmpersandToken": return { kind, value: make<"AmpersandToken">(kind) };
    case "BarToken": return { kind, value: make<"BarToken">(kind) };
    case "CaretToken": return { kind, value: make<"CaretToken">(kind) };
    case "ExclamationToken": return { kind, value: make<"ExclamationToken">(kind) };
    case "TildeToken": return { kind, value: make<"TildeToken">(kind) };
    case "AmpersandAmpersandToken": return { kind, value: make<"AmpersandAmpersandToken">(kind) };
    case "BarBarToken": return { kind, value: make<"BarBarToken">(kind) };
    case "QuestionToken": return { kind, value: make<"QuestionToken">(kind) };
    case "ColonToken": return { kind, value: make<"ColonToken">(kind) };
    case "AtToken": return { kind, value: make<"AtToken">(kind) };
    case "QuestionQuestionToken": return { kind, value: make<"QuestionQuestionToken">(kind) };
    case "BacktickToken": return { kind, value: make<"BacktickToken">(kind) };
    case "HashToken": return { kind, value: make<"HashToken">(kind) };
    case "EqualsToken": return { kind, value: make<"EqualsToken">(kind) };
    case "PlusEqualsToken": return { kind, value: make<"PlusEqualsToken">(kind) };
    case "MinusEqualsToken": return { kind, value: make<"MinusEqualsToken">(kind) };
    case "AsteriskEqualsToken": return { kind, value: make<"AsteriskEqualsToken">(kind) };
    case "AsteriskAsteriskEqualsToken": return { kind, value: make<"AsteriskAsteriskEqualsToken">(kind) };
    case "SlashEqualsToken": return { kind, value: make<"SlashEqualsToken">(kind) };
    case "PercentEqualsToken": return { kind, value: make<"PercentEqualsToken">(kind) };
    case "LessThanLessThanEqualsToken": return { kind, value: make<"LessThanLessThanEqualsToken">(kind) };
    case "GreaterThanGreaterThanEqualsToken": return { kind, value: make<"GreaterThanGreaterThanEqualsToken">(kind) };
    case "GreaterThanGreaterThanGreaterThanEqualsToken": return { kind, value: make<"GreaterThanGreaterThanGreaterThanEqualsToken">(kind) };
    case "AmpersandEqualsToken": return { kind, value: make<"AmpersandEqualsToken">(kind) };
    case "BarEqualsToken": return { kind, value: make<"BarEqualsToken">(kind) };
    case "BarBarEqualsToken": return { kind, value: make<"BarBarEqualsToken">(kind) };
    case "AmpersandAmpersandEqualsToken": return { kind, value: make<"AmpersandAmpersandEqualsToken">(kind) };
    case "QuestionQuestionEqualsToken": return { kind, value: make<"QuestionQuestionEqualsToken">(kind) };
    case "CaretEqualsToken": return { kind, value: make<"CaretEqualsToken">(kind) };
    case "JSDocCommentTextToken": return { kind, value: make<"JSDocCommentTextToken">(kind) };
    case "BreakKeyword": return { kind, value: make<"BreakKeyword">(kind) };
    case "CaseKeyword": return { kind, value: make<"CaseKeyword">(kind) };
    case "CatchKeyword": return { kind, value: make<"CatchKeyword">(kind) };
    case "ClassKeyword": return { kind, value: make<"ClassKeyword">(kind) };
    case "ConstKeyword": return { kind, value: make<"ConstKeyword">(kind) };
    case "ContinueKeyword": return { kind, value: make<"ContinueKeyword">(kind) };
    case "DebuggerKeyword": return { kind, value: make<"DebuggerKeyword">(kind) };
    case "DefaultKeyword": return { kind, value: make<"DefaultKeyword">(kind) };
    case "DeleteKeyword": return { kind, value: make<"DeleteKeyword">(kind) };
    case "DoKeyword": return { kind, value: make<"DoKeyword">(kind) };
    case "ElseKeyword": return { kind, value: make<"ElseKeyword">(kind) };
    case "EnumKeyword": return { kind, value: make<"EnumKeyword">(kind) };
    case "ExportKeyword": return { kind, value: make<"ExportKeyword">(kind) };
    case "ExtendsKeyword": return { kind, value: make<"ExtendsKeyword">(kind) };
    case "FinallyKeyword": return { kind, value: make<"FinallyKeyword">(kind) };
    case "ForKeyword": return { kind, value: make<"ForKeyword">(kind) };
    case "FunctionKeyword": return { kind, value: make<"FunctionKeyword">(kind) };
    case "IfKeyword": return { kind, value: make<"IfKeyword">(kind) };
    case "InKeyword": return { kind, value: make<"InKeyword">(kind) };
    case "InstanceOfKeyword": return { kind, value: make<"InstanceOfKeyword">(kind) };
    case "NewKeyword": return { kind, value: make<"NewKeyword">(kind) };
    case "ReturnKeyword": return { kind, value: make<"ReturnKeyword">(kind) };
    case "SwitchKeyword": return { kind, value: make<"SwitchKeyword">(kind) };
    case "ThrowKeyword": return { kind, value: make<"ThrowKeyword">(kind) };
    case "TryKeyword": return { kind, value: make<"TryKeyword">(kind) };
    case "TypeOfKeyword": return { kind, value: make<"TypeOfKeyword">(kind) };
    case "VarKeyword": return { kind, value: make<"VarKeyword">(kind) };
    case "WhileKeyword": return { kind, value: make<"WhileKeyword">(kind) };
    case "WithKeyword": return { kind, value: make<"WithKeyword">(kind) };
    case "ImplementsKeyword": return { kind, value: make<"ImplementsKeyword">(kind) };
    case "InterfaceKeyword": return { kind, value: make<"InterfaceKeyword">(kind) };
    case "LetKeyword": return { kind, value: make<"LetKeyword">(kind) };
    case "PackageKeyword": return { kind, value: make<"PackageKeyword">(kind) };
    case "PrivateKeyword": return { kind, value: make<"PrivateKeyword">(kind) };
    case "ProtectedKeyword": return { kind, value: make<"ProtectedKeyword">(kind) };
    case "PublicKeyword": return { kind, value: make<"PublicKeyword">(kind) };
    case "StaticKeyword": return { kind, value: make<"StaticKeyword">(kind) };
    case "YieldKeyword": return { kind, value: make<"YieldKeyword">(kind) };
    case "AbstractKeyword": return { kind, value: make<"AbstractKeyword">(kind) };
    case "AccessorKeyword": return { kind, value: make<"AccessorKeyword">(kind) };
    case "AsKeyword": return { kind, value: make<"AsKeyword">(kind) };
    case "AssertsKeyword": return { kind, value: make<"AssertsKeyword">(kind) };
    case "AssertKeyword": return { kind, value: make<"AssertKeyword">(kind) };
    case "AsyncKeyword": return { kind, value: make<"AsyncKeyword">(kind) };
    case "AwaitKeyword": return { kind, value: make<"AwaitKeyword">(kind) };
    case "ConstructorKeyword": return { kind, value: make<"ConstructorKeyword">(kind) };
    case "DeclareKeyword": return { kind, value: make<"DeclareKeyword">(kind) };
    case "GetKeyword": return { kind, value: make<"GetKeyword">(kind) };
    case "ImmediateKeyword": return { kind, value: make<"ImmediateKeyword">(kind) };
    case "InferKeyword": return { kind, value: make<"InferKeyword">(kind) };
    case "IsKeyword": return { kind, value: make<"IsKeyword">(kind) };
    case "KeyOfKeyword": return { kind, value: make<"KeyOfKeyword">(kind) };
    case "ModuleKeyword": return { kind, value: make<"ModuleKeyword">(kind) };
    case "NamespaceKeyword": return { kind, value: make<"NamespaceKeyword">(kind) };
    case "OutKeyword": return { kind, value: make<"OutKeyword">(kind) };
    case "ReadonlyKeyword": return { kind, value: make<"ReadonlyKeyword">(kind) };
    case "RequireKeyword": return { kind, value: make<"RequireKeyword">(kind) };
    case "SatisfiesKeyword": return { kind, value: make<"SatisfiesKeyword">(kind) };
    case "SetKeyword": return { kind, value: make<"SetKeyword">(kind) };
    case "TypeKeyword": return { kind, value: make<"TypeKeyword">(kind) };
    case "UniqueKeyword": return { kind, value: make<"UniqueKeyword">(kind) };
    case "UsingKeyword": return { kind, value: make<"UsingKeyword">(kind) };
    case "FromKeyword": return { kind, value: make<"FromKeyword">(kind) };
    case "GlobalKeyword": return { kind, value: make<"GlobalKeyword">(kind) };
    case "OverrideKeyword": return { kind, value: make<"OverrideKeyword">(kind) };
    case "OfKeyword": return { kind, value: make<"OfKeyword">(kind) };
    case "DeferKeyword": return { kind, value: make<"DeferKeyword">(kind) };
  }
};

export const constructKeywordExpression: TirSyntaxFactory<KeywordExpression<TypedPhase>> = (kind, make) => {
  switch (kind) {
    case "NullKeyword": return { kind, value: make<"NullKeyword">(kind) };
    case "TrueKeyword": return { kind, value: make<"TrueKeyword">(kind) };
    case "FalseKeyword": return { kind, value: make<"FalseKeyword">(kind) };
    case "ThisKeyword": return { kind, value: make<"ThisKeyword">(kind) };
    case "SuperKeyword": return { kind, value: make<"SuperKeyword">(kind) };
    case "ImportKeyword": return { kind, value: make<"ImportKeyword">(kind) };
  }
};

const hasSyntaxKind = <Kind extends TirNode["kind"]>(value: TirSyntaxConstruction, kinds: readonly Kind[]):
  value is TirSyntaxConstruction & { readonly kind: Kind; readonly value: TirConstruction<TirNode & { readonly kind: Kind }> } =>
  kinds.some(kind => kind === value.kind);

const familyReader = <const Kinds extends readonly TirNode["kind"][]>(name: string, kinds: Kinds) =>
  syntaxReader<TirNode & { readonly kind: Kinds[number] }>("$" + name, value => hasSyntaxKind(value, kinds) ? value.value : null);

export interface TirSyntaxReaders {
  readonly AssertsKeyword: TirReader<AssertsKeyword<TypedPhase>>;
  readonly AsteriskToken: TirReader<AsteriskToken<TypedPhase>>;
  readonly AwaitKeyword: TirReader<AwaitKeyword<TypedPhase>>;
  readonly BinaryOperatorToken: TirReader<BinaryOperatorToken<TypedPhase>>;
  readonly BindingElement: TirReader<BindingElement<TypedPhase>>;
  readonly BindingName: TirReader<BindingName<TypedPhase>>;
  readonly Block: TirReader<Block<TypedPhase>>;
  readonly BlockOrExpression: TirReader<BlockOrExpression<TypedPhase>>;
  readonly BodyRoot: TirReader<BodyRoot<TypedPhase>>;
  readonly CaseBlock: TirReader<CaseBlock<TypedPhase>>;
  readonly CaseOrDefaultClause: TirReader<CaseOrDefaultClause<TypedPhase>>;
  readonly CatchClause: TirReader<CatchClause<TypedPhase>>;
  readonly ClassElement: TirReader<ClassElement<TypedPhase>>;
  readonly ColonToken: TirReader<ColonToken<TypedPhase>>;
  readonly DotDotDotToken: TirReader<DotDotDotToken<TypedPhase>>;
  readonly EndOfFile: TirReader<EndOfFile<TypedPhase>>;
  readonly EntityName: TirReader<EntityName<TypedPhase>>;
  readonly EnumMember: TirReader<EnumMember<TypedPhase>>;
  readonly EqualsGreaterThanToken: TirReader<EqualsGreaterThanToken<TypedPhase>>;
  readonly EqualsToken: TirReader<EqualsToken<TypedPhase>>;
  readonly ExclamationToken: TirReader<ExclamationToken<TypedPhase>>;
  readonly ExportSpecifier: TirReader<ExportSpecifier<TypedPhase>>;
  readonly Expression: TirReader<Expression<TypedPhase>>;
  readonly ExpressionWithTypeArguments: TirReader<ExpressionWithTypeArguments<TypedPhase>>;
  readonly ForInitializer: TirReader<ForInitializer<TypedPhase>>;
  readonly HeritageClause: TirReader<HeritageClause<TypedPhase>>;
  readonly Identifier: TirReader<Identifier<TypedPhase>>;
  readonly ImportAttribute: TirReader<ImportAttribute<TypedPhase>>;
  readonly ImportAttributeName: TirReader<ImportAttributeName<TypedPhase>>;
  readonly ImportAttributes: TirReader<ImportAttributes<TypedPhase>>;
  readonly ImportClause: TirReader<ImportClause<TypedPhase>>;
  readonly ImportSpecifier: TirReader<ImportSpecifier<TypedPhase>>;
  readonly JSDocComment: TirReader<JSDocComment<TypedPhase>>;
  readonly JSDocFullName: TirReader<JSDocFullName<TypedPhase>>;
  readonly JSDocTag: TirReader<JSDocTag<TypedPhase>>;
  readonly JsxAttributeLike: TirReader<JsxAttributeLike<TypedPhase>>;
  readonly JsxAttributeName: TirReader<JsxAttributeName<TypedPhase>>;
  readonly JsxAttributeValue: TirReader<JsxAttributeValue<TypedPhase>>;
  readonly JsxAttributes: TirReader<JsxAttributes<TypedPhase>>;
  readonly JsxChild: TirReader<JsxChild<TypedPhase>>;
  readonly JsxClosingElement: TirReader<JsxClosingElement<TypedPhase>>;
  readonly JsxClosingFragment: TirReader<JsxClosingFragment<TypedPhase>>;
  readonly JsxOpeningElement: TirReader<JsxOpeningElement<TypedPhase>>;
  readonly JsxOpeningFragment: TirReader<JsxOpeningFragment<TypedPhase>>;
  readonly JsxTagNameExpression: TirReader<JsxTagNameExpression<TypedPhase>>;
  readonly LeftHandSideExpression: TirReader<LeftHandSideExpression<TypedPhase>>;
  readonly LiteralTypeChild: TirReader<LiteralTypeChild<TypedPhase>>;
  readonly MappedQuestionToken: TirReader<Token<TypedPhase, "QuestionToken" | "PlusToken" | "MinusToken">>;
  readonly MappedReadonlyToken: TirReader<Token<TypedPhase, "ReadonlyKeyword" | "PlusToken" | "MinusToken">>;
  readonly MemberName: TirReader<MemberName<TypedPhase>>;
  readonly ModifierLike: TirReader<ModifierLike<TypedPhase>>;
  readonly ModuleExportName: TirReader<ModuleExportName<TypedPhase>>;
  readonly ModuleName: TirReader<ModuleName<TypedPhase>>;
  readonly ModuleReference: TirReader<ModuleReference<TypedPhase>>;
  readonly NamedExportBindings: TirReader<NamedExportBindings<TypedPhase>>;
  readonly NamedImportBindings: TirReader<NamedImportBindings<TypedPhase>>;
  readonly NodeBody: TirReader<NodeBody<TypedPhase>>;
  readonly ObjectLiteralElementLike: TirReader<ObjectLiteralElementLike<TypedPhase>>;
  readonly ParameterDeclaration: TirReader<ParameterDeclaration<TypedPhase>>;
  readonly PostfixToken: TirReader<Token<TypedPhase, "QuestionToken" | "ExclamationToken">>;
  readonly PropertyName: TirReader<PropertyName<TypedPhase>>;
  readonly QuestionDotToken: TirReader<QuestionDotToken<TypedPhase>>;
  readonly QuestionToken: TirReader<QuestionToken<TypedPhase>>;
  readonly Statement: TirReader<Statement<TypedPhase>>;
  readonly SyntaxNode: TirReader<SyntaxNode<TypedPhase>>;
  readonly TemplateHead: TirReader<TemplateHead<TypedPhase>>;
  readonly TemplateLiteral: TirReader<TemplateLiteral<TypedPhase>>;
  readonly TemplateLiteralTypeSpan: TirReader<TemplateLiteralTypeSpan<TypedPhase>>;
  readonly TemplateMiddleOrTail: TirReader<TemplateMiddleOrTail<TypedPhase>>;
  readonly TemplateSpan: TirReader<TemplateSpan<TypedPhase>>;
  readonly TypeElement: TirReader<TypeElement<TypedPhase>>;
  readonly TypeNode: TirReader<TypeNode<TypedPhase>>;
  readonly TypeParameterDeclaration: TirReader<TypeParameterDeclaration<TypedPhase>>;
  readonly TypePredicateParameterName: TirReader<TypePredicateParameterName<TypedPhase>>;
  readonly VariableDeclaration: TirReader<VariableDeclaration<TypedPhase>>;
  readonly VariableDeclarationList: TirReader<VariableDeclarationList<TypedPhase>>;
}

export const createSyntaxReaders = (): TirSyntaxReaders => ({
  AssertsKeyword: familyReader("AssertsKeyword", ["AssertsKeyword"]),
  AsteriskToken: familyReader("AsteriskToken", ["AsteriskToken"]),
  AwaitKeyword: familyReader("AwaitKeyword", ["AwaitKeyword"]),
  BinaryOperatorToken: familyReader("BinaryOperatorToken", ["QuestionQuestionToken", "AsteriskAsteriskToken", "AsteriskToken", 
    "SlashToken", "PercentToken", "PlusToken", "MinusToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken", 
    "GreaterThanGreaterThanGreaterThanToken", "LessThanToken", "LessThanEqualsToken", "GreaterThanToken", "GreaterThanEqualsToken", 
    "InstanceOfKeyword", "InKeyword", "EqualsEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsEqualsToken", 
    "ExclamationEqualsToken", "AmpersandToken", "BarToken", "CaretToken", "AmpersandAmpersandToken", "BarBarToken", "EqualsToken", 
    "PlusEqualsToken", "MinusEqualsToken", "AsteriskAsteriskEqualsToken", "AsteriskEqualsToken", "SlashEqualsToken", 
    "PercentEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "CaretEqualsToken", "LessThanLessThanEqualsToken", 
    "GreaterThanGreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "BarBarEqualsToken", 
    "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CommaToken"]),
  BindingElement: familyReader("BindingElement", ["BindingElement"]),
  BindingName: familyReader("BindingName", ["Identifier", "ObjectBindingPattern", "ArrayBindingPattern"]),
  Block: familyReader("Block", ["Block"]),
  BlockOrExpression: familyReader("BlockOrExpression", ["Block", "Identifier", "PrivateIdentifier", "ClassExpression", 
    "OmittedExpression", "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword", 
    "StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", 
    "BinaryExpression", "PrefixUnaryExpression", "PostfixUnaryExpression", "YieldExpression", "ArrowFunction", "FunctionExpression", 
    "AsExpression", "SatisfiesExpression", "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", 
    "CallExpression", "NewExpression", "MetaProperty", "NonNullExpression", "SpreadElement", "TemplateExpression", 
    "TaggedTemplateExpression", "ParenthesizedExpression", "ArrayLiteralExpression", "ObjectLiteralExpression", "DeleteExpression", 
    "TypeOfExpression", "VoidExpression", "AwaitExpression", "TypeAssertionExpression", "ExpressionWithTypeArguments", 
    "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement", 
    "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", "JsxExpression", "JsxText", "SyntheticReferenceExpression"]),
  BodyRoot: familyReader("BodyRoot", ["SourceFile", "Block", "Identifier", "PrivateIdentifier", "ClassExpression", 
    "OmittedExpression", "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword", 
    "StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", 
    "BinaryExpression", "PrefixUnaryExpression", "PostfixUnaryExpression", "YieldExpression", "ArrowFunction", "FunctionExpression", 
    "AsExpression", "SatisfiesExpression", "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", 
    "CallExpression", "NewExpression", "MetaProperty", "NonNullExpression", "SpreadElement", "TemplateExpression", 
    "TaggedTemplateExpression", "ParenthesizedExpression", "ArrayLiteralExpression", "ObjectLiteralExpression", "DeleteExpression", 
    "TypeOfExpression", "VoidExpression", "AwaitExpression", "TypeAssertionExpression", "ExpressionWithTypeArguments", 
    "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement", 
    "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", "JsxExpression", "JsxText", "SyntheticReferenceExpression"]),
  CaseBlock: familyReader("CaseBlock", ["CaseBlock"]),
  CaseOrDefaultClause: familyReader("CaseOrDefaultClause", ["CaseClause", "DefaultClause"]),
  CatchClause: familyReader("CatchClause", ["CatchClause"]),
  ClassElement: familyReader("ClassElement", ["Constructor", "GetAccessor", "SetAccessor", "IndexSignature", "MethodDeclaration", 
    "PropertyDeclaration", "SemicolonClassElement", "ClassStaticBlockDeclaration"]),
  ColonToken: familyReader("ColonToken", ["ColonToken"]),
  DotDotDotToken: familyReader("DotDotDotToken", ["DotDotDotToken"]),
  EndOfFile: familyReader("EndOfFile", ["EndOfFile"]),
  EntityName: familyReader("EntityName", ["Identifier", "QualifiedName"]),
  EnumMember: familyReader("EnumMember", ["EnumMember"]),
  EqualsGreaterThanToken: familyReader("EqualsGreaterThanToken", ["EqualsGreaterThanToken"]),
  EqualsToken: familyReader("EqualsToken", ["EqualsToken"]),
  ExclamationToken: familyReader("ExclamationToken", ["ExclamationToken"]),
  ExportSpecifier: familyReader("ExportSpecifier", ["ExportSpecifier"]),
  Expression: familyReader("Expression", ["Identifier", "PrivateIdentifier", "ClassExpression", "OmittedExpression", "NullKeyword", 
    "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword", "StringLiteral", "NumericLiteral", "BigIntLiteral", 
    "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", "BinaryExpression", "PrefixUnaryExpression", 
    "PostfixUnaryExpression", "YieldExpression", "ArrowFunction", "FunctionExpression", "AsExpression", "SatisfiesExpression", 
    "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", "CallExpression", "NewExpression", "MetaProperty", 
    "NonNullExpression", "SpreadElement", "TemplateExpression", "TaggedTemplateExpression", "ParenthesizedExpression", 
    "ArrayLiteralExpression", "ObjectLiteralExpression", "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", 
    "TypeAssertionExpression", "ExpressionWithTypeArguments", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", 
    "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement", "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", 
    "JsxExpression", "JsxText", "SyntheticReferenceExpression"]),
  ExpressionWithTypeArguments: familyReader("ExpressionWithTypeArguments", ["ExpressionWithTypeArguments"]),
  ForInitializer: familyReader("ForInitializer", ["Identifier", "PrivateIdentifier", "ClassExpression", "OmittedExpression", 
    "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword", "StringLiteral", "NumericLiteral", 
    "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", "BinaryExpression", "PrefixUnaryExpression", 
    "PostfixUnaryExpression", "YieldExpression", "ArrowFunction", "FunctionExpression", "AsExpression", "SatisfiesExpression", 
    "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", "CallExpression", "NewExpression", "MetaProperty", 
    "NonNullExpression", "SpreadElement", "TemplateExpression", "TaggedTemplateExpression", "ParenthesizedExpression", 
    "ArrayLiteralExpression", "ObjectLiteralExpression", "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", 
    "TypeAssertionExpression", "ExpressionWithTypeArguments", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", 
    "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement", "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", 
    "JsxExpression", "JsxText", "SyntheticReferenceExpression", "MissingDeclaration", "VariableDeclarationList"]),
  HeritageClause: familyReader("HeritageClause", ["HeritageClause"]),
  Identifier: familyReader("Identifier", ["Identifier"]),
  ImportAttribute: familyReader("ImportAttribute", ["ImportAttribute"]),
  ImportAttributeName: familyReader("ImportAttributeName", ["Identifier", "StringLiteral"]),
  ImportAttributes: familyReader("ImportAttributes", ["ImportAttributes"]),
  ImportClause: familyReader("ImportClause", ["ImportClause"]),
  ImportSpecifier: familyReader("ImportSpecifier", ["ImportSpecifier"]),
  JSDocComment: familyReader("JSDocComment", ["JSDocText", "JSDocLink", "JSDocLinkCode", "JSDocLinkPlain"]),
  JSDocFullName: familyReader("JSDocFullName", ["Identifier", "ModuleDeclaration"]),
  JSDocTag: familyReader("JSDocTag", ["JSDocTypeTag", "JSDocUnknownTag", "JSDocTemplateTag", "JSDocReturnTag", "JSDocPublicTag", 
    "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag", "JSDocOverrideTag", "JSDocDeprecatedTag", "JSDocSeeTag", 
    "JSDocImplementsTag", "JSDocAugmentsTag", "JSDocSatisfiesTag", "JSDocThrowsTag", "JSDocThisTag", "JSDocImportTag", 
    "JSDocCallbackTag", "JSDocOverloadTag", "JSDocTypedefTag", "JSDocParameterTag", "JSDocPropertyTag"]),
  JsxAttributeLike: familyReader("JsxAttributeLike", ["JsxAttribute", "JsxSpreadAttribute"]),
  JsxAttributeName: familyReader("JsxAttributeName", ["Identifier", "JsxNamespacedName"]),
  JsxAttributeValue: familyReader("JsxAttributeValue", ["StringLiteral", "JsxExpression", "JsxElement", "JsxSelfClosingElement", 
    "JsxFragment"]),
  JsxAttributes: familyReader("JsxAttributes", ["JsxAttributes"]),
  JsxChild: familyReader("JsxChild", ["JsxText", "JsxExpression", "JsxElement", "JsxSelfClosingElement", "JsxFragment"]),
  JsxClosingElement: familyReader("JsxClosingElement", ["JsxClosingElement"]),
  JsxClosingFragment: familyReader("JsxClosingFragment", ["JsxClosingFragment"]),
  JsxOpeningElement: familyReader("JsxOpeningElement", ["JsxOpeningElement"]),
  JsxOpeningFragment: familyReader("JsxOpeningFragment", ["JsxOpeningFragment"]),
  JsxTagNameExpression: familyReader("JsxTagNameExpression", ["Identifier", "NullKeyword", "TrueKeyword", "FalseKeyword", 
    "ThisKeyword", "SuperKeyword", "ImportKeyword", "PropertyAccessExpression", "JsxNamespacedName"]),
  LeftHandSideExpression: familyReader("LeftHandSideExpression", ["Identifier", "PrivateIdentifier", "ClassExpression", 
    "StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "FunctionExpression", "PropertyAccessExpression", 
    "ElementAccessExpression", "CallExpression", "NewExpression", "MetaProperty", "NonNullExpression", "TemplateExpression", 
    "TaggedTemplateExpression", "ParenthesizedExpression", "ArrayLiteralExpression", "ObjectLiteralExpression", 
    "ExpressionWithTypeArguments", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxSelfClosingElement", "JsxFragment"]),
  LiteralTypeChild: familyReader("LiteralTypeChild", ["StringLiteral", "NumericLiteral", "BigIntLiteral", 
    "NoSubstitutionTemplateLiteral", "NullKeyword", "TrueKeyword", "FalseKeyword", "PrefixUnaryExpression"]),
  MappedQuestionToken: familyReader("MappedQuestionToken", ["QuestionToken", "PlusToken", "MinusToken"]),
  MappedReadonlyToken: familyReader("MappedReadonlyToken", ["ReadonlyKeyword", "PlusToken", "MinusToken"]),
  MemberName: familyReader("MemberName", ["Identifier", "PrivateIdentifier"]),
  ModifierLike: familyReader("ModifierLike", ["AbstractKeyword", "AccessorKeyword", "AsyncKeyword", "ConstKeyword", "DeclareKeyword", 
    "DefaultKeyword", "ExportKeyword", "InKeyword", "PrivateKeyword", "ProtectedKeyword", "PublicKeyword", "ReadonlyKeyword", 
    "OutKeyword", "OverrideKeyword", "StaticKeyword", "Decorator"]),
  ModuleExportName: familyReader("ModuleExportName", ["Identifier", "StringLiteral"]),
  ModuleName: familyReader("ModuleName", ["Identifier", "StringLiteral"]),
  ModuleReference: familyReader("ModuleReference", ["Identifier", "QualifiedName", "ExternalModuleReference"]),
  NamedExportBindings: familyReader("NamedExportBindings", ["NamespaceExport", "NamedExports"]),
  NamedImportBindings: familyReader("NamedImportBindings", ["NamespaceImport", "NamedImports"]),
  NodeBody: familyReader("NodeBody", ["Block", "Identifier", "PrivateIdentifier", "ClassExpression", "OmittedExpression", 
    "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword", "StringLiteral", "NumericLiteral", 
    "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", "BinaryExpression", "PrefixUnaryExpression", 
    "PostfixUnaryExpression", "YieldExpression", "ArrowFunction", "FunctionExpression", "AsExpression", "SatisfiesExpression", 
    "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", "CallExpression", "NewExpression", "MetaProperty", 
    "NonNullExpression", "SpreadElement", "TemplateExpression", "TaggedTemplateExpression", "ParenthesizedExpression", 
    "ArrayLiteralExpression", "ObjectLiteralExpression", "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", 
    "TypeAssertionExpression", "ExpressionWithTypeArguments", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", 
    "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement", "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", 
    "JsxExpression", "JsxText", "SyntheticReferenceExpression", "ModuleBlock", "ModuleDeclaration"]),
  ObjectLiteralElementLike: familyReader("ObjectLiteralElementLike", ["PropertyAssignment", "ShorthandPropertyAssignment", 
    "SpreadAssignment", "MethodDeclaration", "GetAccessor", "SetAccessor"]),
  ParameterDeclaration: familyReader("ParameterDeclaration", ["Parameter"]),
  PostfixToken: familyReader("PostfixToken", ["QuestionToken", "ExclamationToken"]),
  PropertyName: familyReader("PropertyName", ["Identifier", "StringLiteral", "NoSubstitutionTemplateLiteral", "NumericLiteral", 
    "ComputedPropertyName", "PrivateIdentifier", "BigIntLiteral"]),
  QuestionDotToken: familyReader("QuestionDotToken", ["QuestionDotToken"]),
  QuestionToken: familyReader("QuestionToken", ["QuestionToken"]),
  Statement: familyReader("Statement", ["EmptyStatement", "IfStatement", "DoStatement", "WhileStatement", "ForStatement", 
    "ForInStatement", "ForOfStatement", "BreakStatement", "ContinueStatement", "ReturnStatement", "WithStatement", "SwitchStatement", 
    "ThrowStatement", "TryStatement", "DebuggerStatement", "LabeledStatement", "ExpressionStatement", "Block", "VariableStatement", 
    "MissingDeclaration", "FunctionDeclaration", "ClassDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", 
    "JSTypeAliasDeclaration", "EnumDeclaration", "ModuleBlock", "NotEmittedStatement", "ImportDeclaration", "JSImportDeclaration", 
    "ExportAssignment", "NamespaceExportDeclaration", "ModuleDeclaration", "ImportEqualsDeclaration", "ExportDeclaration"]),
  SyntaxNode: familyReader("SyntaxNode", ["Block", "FunctionDeclaration", "Constructor", "GetAccessor", "SetAccessor", 
    "MethodDeclaration", "ClassStaticBlockDeclaration", "ArrowFunction", "FunctionExpression", "SourceFile", "ClassDeclaration", 
    "ClassExpression", "HeritageClause", "InterfaceDeclaration", "TypeAliasDeclaration", "JSTypeAliasDeclaration", "EnumMember", 
    "EnumDeclaration", "JSDoc", "JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocAllType", 
    "JSDocVariadicType", "JSDocOptionalType", "JSDocTypeTag", "JSDocUnknownTag", "JSDocTemplateTag", "JSDocReturnTag", 
    "JSDocPublicTag", "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag", "JSDocOverrideTag", "JSDocDeprecatedTag", 
    "JSDocSeeTag", "JSDocImplementsTag", "JSDocAugmentsTag", "JSDocSatisfiesTag", "JSDocThrowsTag", "JSDocThisTag", "JSDocImportTag", 
    "JSDocCallbackTag", "JSDocOverloadTag", "JSDocTypedefTag", "JSDocSignature", "JSDocNameReference", "JSDocText", "JSDocLink", 
    "JSDocLinkPlain", "JSDocLinkCode", "JSDocTypeLiteral", "JSDocParameterTag", "JSDocPropertyTag", "JsxElement", "JsxAttributes", 
    "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement", "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", 
    "JsxAttribute", "JsxSpreadAttribute", "JsxClosingElement", "JsxExpression", "JsxText", "EmptyStatement", "IfStatement", 
    "DoStatement", "WhileStatement", "ForStatement", "ForInStatement", "ForOfStatement", "BreakStatement", "ContinueStatement", 
    "ReturnStatement", "WithStatement", "SwitchStatement", "CaseBlock", "CaseClause", "DefaultClause", "ThrowStatement", 
    "TryStatement", "CatchClause", "DebuggerStatement", "LabeledStatement", "ExpressionStatement", "VariableStatement", 
    "VariableDeclaration", "VariableDeclarationList", "ObjectBindingPattern", "ArrayBindingPattern", "Parameter", "BindingElement", 
    "MissingDeclaration", "ModuleBlock", "NotEmittedStatement", "ImportDeclaration", "JSImportDeclaration", "NamespaceImport", 
    "NamedImports", "ExportAssignment", "NamespaceExportDeclaration", "NamespaceExport", "NamedExports", "ExportSpecifier", 
    "PropertyDeclaration", "SemicolonClassElement", "ImportAttribute", "ImportAttributes", "ModuleDeclaration", 
    "ImportEqualsDeclaration", "ExportDeclaration", "ImportClause", "ImportSpecifier", "CallSignature", "ConstructSignature", 
    "IndexSignature", "MethodSignature", "PropertySignature", "TypeAssertionExpression", "AnyKeyword", "BigIntKeyword", 
    "BooleanKeyword", "IntrinsicKeyword", "NeverKeyword", "NumberKeyword", "ObjectKeyword", "StringKeyword", "SymbolKeyword", 
    "UndefinedKeyword", "UnknownKeyword", "VoidKeyword", "UnionType", "IntersectionType", "ConditionalType", "TypeOperator", 
    "InferType", "ArrayType", "IndexedAccessType", "TypeReference", "LiteralType", "ThisType", "TypePredicate", "TypeQuery", 
    "MappedType", "TypeLiteral", "TupleType", "NamedTupleMember", "OptionalType", "RestType", "ParenthesizedType", "FunctionType", 
    "ConstructorType", "TemplateLiteralType", "ImportType", "TypeParameter", "SyntaxList", "Unknown", "EndOfFile", 
    "SingleLineCommentTrivia", "MultiLineCommentTrivia", "NewLineTrivia", "WhitespaceTrivia", "ConflictMarkerTrivia", 
    "NonTextFileMarkerTrivia", "JsxTextAllWhiteSpaces", "OpenBraceToken", "CloseBraceToken", "OpenParenToken", "CloseParenToken", 
    "OpenBracketToken", "CloseBracketToken", "DotToken", "DotDotDotToken", "SemicolonToken", "CommaToken", "QuestionDotToken", 
    "LessThanToken", "LessThanSlashToken", "GreaterThanToken", "LessThanEqualsToken", "GreaterThanEqualsToken", "EqualsEqualsToken", 
    "ExclamationEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsEqualsToken", "EqualsGreaterThanToken", "PlusToken", 
    "MinusToken", "AsteriskToken", "AsteriskAsteriskToken", "SlashToken", "PercentToken", "PlusPlusToken", "MinusMinusToken", 
    "LessThanLessThanToken", "GreaterThanGreaterThanToken", "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken", "BarToken", 
    "CaretToken", "ExclamationToken", "TildeToken", "AmpersandAmpersandToken", "BarBarToken", "QuestionToken", "ColonToken", 
    "AtToken", "QuestionQuestionToken", "BacktickToken", "HashToken", "EqualsToken", "PlusEqualsToken", "MinusEqualsToken", 
    "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken", "SlashEqualsToken", "PercentEqualsToken", "LessThanLessThanEqualsToken", 
    "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", 
    "BarBarEqualsToken", "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CaretEqualsToken", "JSDocCommentTextToken", 
    "BreakKeyword", "CaseKeyword", "CatchKeyword", "ClassKeyword", "ConstKeyword", "ContinueKeyword", "DebuggerKeyword", 
    "DefaultKeyword", "DeleteKeyword", "DoKeyword", "ElseKeyword", "EnumKeyword", "ExportKeyword", "ExtendsKeyword", "FinallyKeyword", 
    "ForKeyword", "FunctionKeyword", "IfKeyword", "InKeyword", "InstanceOfKeyword", "NewKeyword", "ReturnKeyword", "SwitchKeyword", 
    "ThrowKeyword", "TryKeyword", "TypeOfKeyword", "VarKeyword", "WhileKeyword", "WithKeyword", "ImplementsKeyword", 
    "InterfaceKeyword", "LetKeyword", "PackageKeyword", "PrivateKeyword", "ProtectedKeyword", "PublicKeyword", "StaticKeyword", 
    "YieldKeyword", "AbstractKeyword", "AccessorKeyword", "AsKeyword", "AssertsKeyword", "AssertKeyword", "AsyncKeyword", 
    "AwaitKeyword", "ConstructorKeyword", "DeclareKeyword", "GetKeyword", "ImmediateKeyword", "InferKeyword", "IsKeyword", 
    "KeyOfKeyword", "ModuleKeyword", "NamespaceKeyword", "OutKeyword", "ReadonlyKeyword", "RequireKeyword", "SatisfiesKeyword", 
    "SetKeyword", "TypeKeyword", "UniqueKeyword", "UsingKeyword", "FromKeyword", "GlobalKeyword", "OverrideKeyword", "OfKeyword", 
    "DeferKeyword", "Identifier", "PrivateIdentifier", "QualifiedName", "ComputedPropertyName", "Decorator", "NotEmittedTypeElement", 
    "ExternalModuleReference", "OmittedExpression", "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", 
    "ImportKeyword", "StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", 
    "BinaryExpression", "PrefixUnaryExpression", "PostfixUnaryExpression", "YieldExpression", "AsExpression", "SatisfiesExpression", 
    "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", "CallExpression", "NewExpression", "MetaProperty", 
    "NonNullExpression", "SpreadElement", "TemplateExpression", "TemplateSpan", "TaggedTemplateExpression", "ParenthesizedExpression", 
    "ArrayLiteralExpression", "ObjectLiteralExpression", "SpreadAssignment", "PropertyAssignment", "ShorthandPropertyAssignment", 
    "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", "ExpressionWithTypeArguments", "TemplateHead", 
    "TemplateMiddle", "TemplateTail", "TemplateLiteralTypeSpan", "PartiallyEmittedExpression", "SyntheticReferenceExpression"]),
  TemplateHead: familyReader("TemplateHead", ["TemplateHead"]),
  TemplateLiteral: familyReader("TemplateLiteral", ["TemplateExpression", "NoSubstitutionTemplateLiteral"]),
  TemplateLiteralTypeSpan: familyReader("TemplateLiteralTypeSpan", ["TemplateLiteralTypeSpan"]),
  TemplateMiddleOrTail: familyReader("TemplateMiddleOrTail", ["TemplateMiddle", "TemplateTail"]),
  TemplateSpan: familyReader("TemplateSpan", ["TemplateSpan"]),
  TypeElement: familyReader("TypeElement", ["NotEmittedTypeElement", "CallSignature", "ConstructSignature", "GetAccessor", 
    "SetAccessor", "IndexSignature", "MethodSignature", "PropertySignature"]),
  TypeNode: familyReader("TypeNode", ["AnyKeyword", "BigIntKeyword", "BooleanKeyword", "IntrinsicKeyword", "NeverKeyword", 
    "NumberKeyword", "ObjectKeyword", "StringKeyword", "SymbolKeyword", "UndefinedKeyword", "UnknownKeyword", "VoidKeyword", 
    "UnionType", "IntersectionType", "ConditionalType", "TypeOperator", "InferType", "ArrayType", "IndexedAccessType", 
    "TypeReference", "LiteralType", "ThisType", "TypePredicate", "TypeQuery", "MappedType", "TypeLiteral", "TupleType", 
    "NamedTupleMember", "OptionalType", "RestType", "ParenthesizedType", "FunctionType", "ConstructorType", "TemplateLiteralType", 
    "TemplateLiteralTypeSpan", "JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocAllType", 
    "JSDocVariadicType", "JSDocOptionalType", "JSDocSignature", "JSDocNameReference", "ImportType", "JSDocTypeLiteral"]),
  TypeParameterDeclaration: familyReader("TypeParameterDeclaration", ["TypeParameter"]),
  TypePredicateParameterName: familyReader("TypePredicateParameterName", ["Identifier", "ThisType"]),
  VariableDeclaration: familyReader("VariableDeclaration", ["VariableDeclaration"]),
  VariableDeclarationList: familyReader("VariableDeclarationList", ["VariableDeclarationList"]),
});

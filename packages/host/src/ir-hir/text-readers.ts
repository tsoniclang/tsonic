import type * as Hir from "./contract.js";
import type { HirReader, HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
import { createHirScalarReaders } from "./text-read-scalars.js";
import { createSyntaxGroup0 } from "./text-read-syntax-0.js";
import { createSyntaxGroup1 } from "./text-read-syntax-1.js";
import { createSyntaxGroup2 } from "./text-read-syntax-2.js";
import { createSyntaxGroup3 } from "./text-read-syntax-3.js";
import { createSyntaxGroup4 } from "./text-read-syntax-4.js";
import { createSyntaxGroup5 } from "./text-read-syntax-5.js";
import { createSyntaxGroup6 } from "./text-read-syntax-6.js";
import { createSyntaxGroup7 } from "./text-read-syntax-7.js";
import { createSyntaxGroup8 } from "./text-read-syntax-8.js";
import { createSyntaxGroup9 } from "./text-read-syntax-9.js";
import { createSyntaxGroup10 } from "./text-read-syntax-10.js";
import { createSyntaxGroup11 } from "./text-read-syntax-11.js";
import { createSyntaxGroup12 } from "./text-read-syntax-12.js";
import { createSyntaxGroup13 } from "./text-read-syntax-13.js";
import { createReadGroup0 } from "./text-read-0.js";
import { createReadGroup1 } from "./text-read-1.js";
import { createReadGroup2 } from "./text-read-2.js";
import { createReadGroup3 } from "./text-read-3.js";
import { createReadGroup4 } from "./text-read-4.js";
import { createReadGroup5 } from "./text-read-5.js";
import { createReadGroup6 } from "./text-read-6.js";
import { createReadGroup7 } from "./text-read-7.js";
import { createReadGroup8 } from "./text-read-8.js";
import { createReadGroup9 } from "./text-read-9.js";
import { createBindingTextReaders } from "./text-read-bindings.js";
export function createHirTextReaders(): HirTextReaders {
  const readers: HirTextReaders = {
    ...createHirScalarReaders(),
    ...createBindingTextReaders(() => readers),
    ...createReadGroup0(() => readers),
    ...createReadGroup1(() => readers),
    ...createReadGroup2(() => readers),
    ...createReadGroup3(() => readers),
    ...createReadGroup4(() => readers),
    ...createReadGroup5(() => readers),
    ...createReadGroup6(() => readers),
    ...createReadGroup7(() => readers),
    ...createReadGroup8(() => readers),
    ...createReadGroup9(() => readers),
    syntax_0: syntaxReader<Hir.SourceFile<Hir.CheckedPhase>>(["SourceFile"]),
    syntax_1: syntaxReader<Hir.BodyRoot<Hir.CheckedPhase>>(["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","Block","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FunctionExpression","Identifier","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","FalseKeyword","ImportKeyword","NullKeyword","SuperKeyword","ThisKeyword","TrueKeyword","MetaProperty","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SourceFile","SpreadElement","StringLiteral","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","TypeAssertionExpression","TypeOfExpression","VoidExpression","YieldExpression"]),
    syntax_2: syntaxReader<Hir.Expression<Hir.CheckedPhase>>(["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FunctionExpression","Identifier","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","FalseKeyword","ImportKeyword","NullKeyword","SuperKeyword","ThisKeyword","TrueKeyword","MetaProperty","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","TypeAssertionExpression","TypeOfExpression","VoidExpression","YieldExpression"]),
    syntax_3: syntaxReader<Hir.TypeNode<Hir.CheckedPhase>>(["ArrayType","ConditionalType","ConstructorType","FunctionType","ImportType","IndexedAccessType","InferType","IntersectionType","JSDocAllType","JSDocNameReference","JSDocNonNullableType","JSDocNullableType","JSDocOptionalType","JSDocSignature","JSDocTypeExpression","JSDocTypeLiteral","JSDocVariadicType","AnyKeyword","BigIntKeyword","BooleanKeyword","IntrinsicKeyword","NeverKeyword","NumberKeyword","ObjectKeyword","StringKeyword","SymbolKeyword","UndefinedKeyword","UnknownKeyword","VoidKeyword","LiteralType","MappedType","NamedTupleMember","OptionalType","ParenthesizedType","RestType","TemplateLiteralType","TemplateLiteralTypeSpan","ThisType","TupleType","TypeLiteral","TypeOperator","TypePredicate","TypeQuery","TypeReference","UnionType"]),
    syntax_4: syntaxReader<Hir.ModifierLike<Hir.CheckedPhase>>(["Decorator","AbstractKeyword","AccessorKeyword","AsyncKeyword","ConstKeyword","DeclareKeyword","DefaultKeyword","ExportKeyword","InKeyword","OutKeyword","OverrideKeyword","PrivateKeyword","ProtectedKeyword","PublicKeyword","ReadonlyKeyword","StaticKeyword"]),
    syntax_5: syntaxReader<Hir.TypeParameterDeclaration<Hir.CheckedPhase>>(["TypeParameter"]),
    syntax_6: syntaxReader<Hir.ParameterDeclaration<Hir.CheckedPhase>>(["Parameter"]),
    syntax_7: syntaxReader<Hir.AsteriskToken<Hir.CheckedPhase>>(["AsteriskToken"]),
    syntax_8: syntaxReader<Hir.BlockOrExpression<Hir.CheckedPhase>>(["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","Block","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FunctionExpression","Identifier","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","FalseKeyword","ImportKeyword","NullKeyword","SuperKeyword","ThisKeyword","TrueKeyword","MetaProperty","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","TypeAssertionExpression","TypeOfExpression","VoidExpression","YieldExpression"]),
    syntax_9: syntaxReader<Hir.EqualsGreaterThanToken<Hir.CheckedPhase>>(["EqualsGreaterThanToken"]),
    syntax_10: syntaxReader<Hir.BinaryOperatorToken<Hir.CheckedPhase>>(["AmpersandAmpersandEqualsToken","AmpersandAmpersandToken","AmpersandEqualsToken","AmpersandToken","AsteriskAsteriskEqualsToken","AsteriskAsteriskToken","AsteriskEqualsToken","AsteriskToken","BarBarEqualsToken","BarBarToken","BarEqualsToken","BarToken","CaretEqualsToken","CaretToken","CommaToken","EqualsEqualsEqualsToken","EqualsEqualsToken","EqualsToken","ExclamationEqualsEqualsToken","ExclamationEqualsToken","GreaterThanEqualsToken","GreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanToken","GreaterThanGreaterThanToken","GreaterThanToken","InKeyword","InstanceOfKeyword","LessThanEqualsToken","LessThanLessThanEqualsToken","LessThanLessThanToken","LessThanToken","MinusEqualsToken","MinusToken","PercentEqualsToken","PercentToken","PlusEqualsToken","PlusToken","QuestionQuestionEqualsToken","QuestionQuestionToken","SlashEqualsToken","SlashToken"]),
    syntax_11: syntaxReader<Hir.DotDotDotToken<Hir.CheckedPhase>>(["DotDotDotToken"]),
    syntax_12: syntaxReader<Hir.PropertyName<Hir.CheckedPhase>>(["BigIntLiteral","ComputedPropertyName","Identifier","NoSubstitutionTemplateLiteral","NumericLiteral","PrivateIdentifier","StringLiteral"]),
    syntax_13: syntaxReader<Hir.BindingName<Hir.CheckedPhase>>(["ArrayBindingPattern","ObjectBindingPattern","Identifier"]),
    syntax_14: syntaxReader<Hir.BindingElement<Hir.CheckedPhase>>(["BindingElement"]),
    syntax_15: syntaxReader<Hir.Statement<Hir.CheckedPhase>>(["Block","BreakStatement","ClassDeclaration","ContinueStatement","DebuggerStatement","DoStatement","EmptyStatement","EnumDeclaration","ExportAssignment","ExportDeclaration","ExpressionStatement","ForInStatement","ForOfStatement","ForStatement","FunctionDeclaration","IfStatement","ImportDeclaration","JSImportDeclaration","ImportEqualsDeclaration","InterfaceDeclaration","LabeledStatement","MissingDeclaration","ModuleBlock","ModuleDeclaration","NamespaceExportDeclaration","NotEmittedStatement","ReturnStatement","SwitchStatement","ThrowStatement","TryStatement","JSTypeAliasDeclaration","TypeAliasDeclaration","VariableStatement","WhileStatement","WithStatement"]),
    syntax_16: syntaxReader<Hir.Identifier<Hir.CheckedPhase>>(["Identifier"]),
    syntax_17: syntaxReader<Hir.QuestionDotToken<Hir.CheckedPhase>>(["QuestionDotToken"]),
    syntax_18: syntaxReader<Hir.CaseOrDefaultClause<Hir.CheckedPhase>>(["CaseClause","DefaultClause"]),
    syntax_19: syntaxReader<Hir.VariableDeclaration<Hir.CheckedPhase>>(["VariableDeclaration"]),
    syntax_20: syntaxReader<Hir.Block<Hir.CheckedPhase>>(["Block"]),
    syntax_21: syntaxReader<Hir.HeritageClause<Hir.CheckedPhase>>(["HeritageClause"]),
    syntax_22: syntaxReader<Hir.ClassElement<Hir.CheckedPhase>>(["ClassStaticBlockDeclaration","Constructor","GetAccessor","IndexSignature","MethodDeclaration","PropertyDeclaration","SemicolonClassElement","SetAccessor"]),
    syntax_23: syntaxReader<Hir.QuestionToken<Hir.CheckedPhase>>(["QuestionToken"]),
    syntax_24: syntaxReader<Hir.ColonToken<Hir.CheckedPhase>>(["ColonToken"]),
    syntax_25: syntaxReader<Hir.LeftHandSideExpression<Hir.CheckedPhase>>(["ArrayLiteralExpression","BigIntLiteral","CallExpression","ClassExpression","ElementAccessExpression","ExpressionWithTypeArguments","FunctionExpression","Identifier","JsxAttributes","JsxElement","JsxFragment","JsxSelfClosingElement","MetaProperty","NewExpression","NonNullExpression","NumericLiteral","ObjectLiteralExpression","ParenthesizedExpression","PartiallyEmittedExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","StringLiteral","TaggedTemplateExpression","TemplateExpression"]),
    syntax_26: syntaxReader<Hir.EnumMember<Hir.CheckedPhase>>(["EnumMember"]),
    syntax_27: syntaxReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase>>(["ExclamationToken","QuestionToken"]),
    syntax_28: syntaxReader<Hir.NamedExportBindings<Hir.CheckedPhase>>(["NamedExports","NamespaceExport"]),
    syntax_29: syntaxReader<Hir.ImportAttributes<Hir.CheckedPhase>>(["ImportAttributes"]),
    syntax_30: syntaxReader<Hir.ModuleExportName<Hir.CheckedPhase>>(["Identifier","StringLiteral"]),
    syntax_31: syntaxReader<Hir.ForInitializer<Hir.CheckedPhase>>(["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FunctionExpression","Identifier","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","FalseKeyword","ImportKeyword","NullKeyword","SuperKeyword","ThisKeyword","TrueKeyword","MetaProperty","MissingDeclaration","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","TypeAssertionExpression","TypeOfExpression","VariableDeclarationList","VoidExpression","YieldExpression"]),
    syntax_32: syntaxReader<Hir.AwaitKeyword<Hir.CheckedPhase>>(["AwaitKeyword"]),
    syntax_33: syntaxReader<Hir.ExpressionWithTypeArguments<Hir.CheckedPhase>>(["ExpressionWithTypeArguments"]),
    syntax_34: syntaxReader<Hir.ImportAttributeName<Hir.CheckedPhase>>(["Identifier","StringLiteral"]),
    syntax_35: syntaxReader<Hir.ImportAttribute<Hir.CheckedPhase>>(["ImportAttribute"]),
    syntax_36: syntaxReader<Hir.NamedImportBindings<Hir.CheckedPhase>>(["NamedImports","NamespaceImport"]),
    syntax_37: syntaxReader<Hir.ImportClause<Hir.CheckedPhase>>(["ImportClause"]),
    syntax_38: syntaxReader<Hir.ModuleReference<Hir.CheckedPhase>>(["ExternalModuleReference","Identifier","QualifiedName"]),
    syntax_39: syntaxReader<Hir.EntityName<Hir.CheckedPhase>>(["Identifier","QualifiedName"]),
    syntax_40: syntaxReader<Hir.TypeElement<Hir.CheckedPhase>>(["CallSignature","ConstructSignature","GetAccessor","IndexSignature","MethodSignature","NotEmittedTypeElement","PropertySignature","SetAccessor"]),
    syntax_41: syntaxReader<Hir.JSDocComment<Hir.CheckedPhase>>(["JSDocLink","JSDocLinkCode","JSDocLinkPlain","JSDocText"]),
    syntax_42: syntaxReader<Hir.JSDocTag<Hir.CheckedPhase>>(["JSDocAugmentsTag","JSDocCallbackTag","JSDocDeprecatedTag","JSDocImplementsTag","JSDocImportTag","JSDocOverloadTag","JSDocOverrideTag","JSDocParameterTag","JSDocPropertyTag","JSDocPrivateTag","JSDocProtectedTag","JSDocPublicTag","JSDocReadonlyTag","JSDocReturnTag","JSDocSatisfiesTag","JSDocSeeTag","JSDocTemplateTag","JSDocThisTag","JSDocThrowsTag","JSDocTypeTag","JSDocTypedefTag","JSDocUnknownTag"]),
    syntax_43: syntaxReader<Hir.JSDocFullName<Hir.CheckedPhase>>(["Identifier","ModuleDeclaration"]),
    syntax_44: syntaxReader<Hir.SyntaxNode<Hir.CheckedPhase>>(["ArrayLiteralExpression","ArrayType","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","BindingElement","ArrayBindingPattern","ObjectBindingPattern","Block","BreakStatement","CallExpression","CallSignature","CaseBlock","CaseClause","CatchClause","ClassDeclaration","ClassExpression","ClassStaticBlockDeclaration","ComputedPropertyName","ConditionalExpression","ConditionalType","ConstructSignature","Constructor","ConstructorType","ContinueStatement","DebuggerStatement","Decorator","DefaultClause","DeleteExpression","DoStatement","ElementAccessExpression","EmptyStatement","EnumDeclaration","EnumMember","ExportAssignment","ExportDeclaration","ExportSpecifier","ExpressionStatement","ExpressionWithTypeArguments","ExternalModuleReference","ForInStatement","ForOfStatement","ForStatement","FunctionDeclaration","FunctionExpression","FunctionType","GetAccessor","HeritageClause","Identifier","IfStatement","ImportAttribute","ImportAttributes","ImportClause","ImportDeclaration","JSImportDeclaration","ImportEqualsDeclaration","ImportSpecifier","ImportType","IndexSignature","IndexedAccessType","InferType","InterfaceDeclaration","IntersectionType","JSDoc","JSDocAllType","JSDocAugmentsTag","JSDocCallbackTag","JSDocDeprecatedTag","JSDocImplementsTag","JSDocImportTag","JSDocLink","JSDocLinkCode","JSDocLinkPlain","JSDocNameReference","JSDocNonNullableType","JSDocNullableType","JSDocOptionalType","JSDocOverloadTag","JSDocOverrideTag","JSDocParameterTag","JSDocPropertyTag","JSDocPrivateTag","JSDocProtectedTag","JSDocPublicTag","JSDocReadonlyTag","JSDocReturnTag","JSDocSatisfiesTag","JSDocSeeTag","JSDocSignature","JSDocTemplateTag","JSDocText","JSDocThisTag","JSDocThrowsTag","JSDocTypeExpression","JSDocTypeLiteral","JSDocTypeTag","JSDocTypedefTag","JSDocUnknownTag","JSDocVariadicType","JsxAttribute","JsxAttributes","JsxClosingElement","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxSpreadAttribute","JsxText","FalseKeyword","ImportKeyword","NullKeyword","SuperKeyword","ThisKeyword","TrueKeyword","AnyKeyword","BigIntKeyword","BooleanKeyword","IntrinsicKeyword","NeverKeyword","NumberKeyword","ObjectKeyword","StringKeyword","SymbolKeyword","UndefinedKeyword","UnknownKeyword","VoidKeyword","LabeledStatement","LiteralType","MappedType","MetaProperty","MethodDeclaration","MethodSignature","MissingDeclaration","ModuleBlock","ModuleDeclaration","NamedExports","NamedImports","NamedTupleMember","NamespaceExport","NamespaceExportDeclaration","NamespaceImport","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NotEmittedStatement","NotEmittedTypeElement","NumericLiteral","ObjectLiteralExpression","OmittedExpression","OptionalType","Parameter","ParenthesizedExpression","ParenthesizedType","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","PropertyAssignment","PropertyDeclaration","PropertySignature","QualifiedName","RegularExpressionLiteral","RestType","ReturnStatement","SatisfiesExpression","SemicolonClassElement","SetAccessor","ShorthandPropertyAssignment","SourceFile","SpreadAssignment","SpreadElement","StringLiteral","SwitchStatement","SyntaxList","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","TemplateHead","TemplateLiteralType","TemplateLiteralTypeSpan","TemplateMiddle","TemplateSpan","TemplateTail","ThisType","ThrowStatement","AbstractKeyword","AccessorKeyword","AmpersandAmpersandEqualsToken","AmpersandAmpersandToken","AmpersandEqualsToken","AmpersandToken","AsKeyword","AssertKeyword","AssertsKeyword","AsteriskAsteriskEqualsToken","AsteriskAsteriskToken","AsteriskEqualsToken","AsteriskToken","AsyncKeyword","AtToken","AwaitKeyword","BacktickToken","BarBarEqualsToken","BarBarToken","BarEqualsToken","BarToken","BreakKeyword","CaretEqualsToken","CaretToken","CaseKeyword","CatchKeyword","ClassKeyword","CloseBraceToken","CloseBracketToken","CloseParenToken","ColonToken","CommaToken","ConflictMarkerTrivia","ConstKeyword","ConstructorKeyword","ContinueKeyword","DebuggerKeyword","DeclareKeyword","DefaultKeyword","DeferKeyword","DeleteKeyword","DoKeyword","DotDotDotToken","DotToken","ElseKeyword","EndOfFile","EnumKeyword","EqualsEqualsEqualsToken","EqualsEqualsToken","EqualsGreaterThanToken","EqualsToken","ExclamationEqualsEqualsToken","ExclamationEqualsToken","ExclamationToken","ExportKeyword","ExtendsKeyword","FinallyKeyword","ForKeyword","FromKeyword","FunctionKeyword","GetKeyword","GlobalKeyword","GreaterThanEqualsToken","GreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanToken","GreaterThanGreaterThanToken","GreaterThanToken","HashToken","IfKeyword","ImmediateKeyword","ImplementsKeyword","InKeyword","InferKeyword","InstanceOfKeyword","InterfaceKeyword","IsKeyword","JSDocCommentTextToken","JsxTextAllWhiteSpaces","KeyOfKeyword","LessThanEqualsToken","LessThanLessThanEqualsToken","LessThanLessThanToken","LessThanSlashToken","LessThanToken","LetKeyword","MinusEqualsToken","MinusMinusToken","MinusToken","ModuleKeyword","MultiLineCommentTrivia","NamespaceKeyword","NewKeyword","NewLineTrivia","NonTextFileMarkerTrivia","OfKeyword","OpenBraceToken","OpenBracketToken","OpenParenToken","OutKeyword","OverrideKeyword","PackageKeyword","PercentEqualsToken","PercentToken","PlusEqualsToken","PlusPlusToken","PlusToken","PrivateKeyword","ProtectedKeyword","PublicKeyword","QuestionDotToken","QuestionQuestionEqualsToken","QuestionQuestionToken","QuestionToken","ReadonlyKeyword","RequireKeyword","ReturnKeyword","SatisfiesKeyword","SemicolonToken","SetKeyword","SingleLineCommentTrivia","SlashEqualsToken","SlashToken","StaticKeyword","SwitchKeyword","ThrowKeyword","TildeToken","TryKeyword","TypeKeyword","TypeOfKeyword","UniqueKeyword","Unknown","UsingKeyword","VarKeyword","WhileKeyword","WhitespaceTrivia","WithKeyword","YieldKeyword","TryStatement","TupleType","JSTypeAliasDeclaration","TypeAliasDeclaration","TypeAssertionExpression","TypeLiteral","TypeOfExpression","TypeOperator","TypeParameter","TypePredicate","TypeQuery","TypeReference","UnionType","VariableDeclaration","VariableDeclarationList","VariableStatement","VoidExpression","WhileStatement","WithStatement","YieldExpression"]),
    syntax_45: syntaxReader<Hir.JsxAttributeName<Hir.CheckedPhase>>(["Identifier","JsxNamespacedName"]),
    syntax_46: syntaxReader<Hir.JsxAttributeValue<Hir.CheckedPhase>>(["JsxElement","JsxExpression","JsxFragment","JsxSelfClosingElement","StringLiteral"]),
    syntax_47: syntaxReader<Hir.JsxAttributeLike<Hir.CheckedPhase>>(["JsxAttribute","JsxSpreadAttribute"]),
    syntax_48: syntaxReader<Hir.JsxTagNameExpression<Hir.CheckedPhase>>(["Identifier","JsxNamespacedName","FalseKeyword","ImportKeyword","NullKeyword","SuperKeyword","ThisKeyword","TrueKeyword","PropertyAccessExpression"]),
    syntax_49: syntaxReader<Hir.JsxOpeningElement<Hir.CheckedPhase>>(["JsxOpeningElement"]),
    syntax_50: syntaxReader<Hir.JsxChild<Hir.CheckedPhase>>(["JsxElement","JsxExpression","JsxFragment","JsxSelfClosingElement","JsxText"]),
    syntax_51: syntaxReader<Hir.JsxClosingElement<Hir.CheckedPhase>>(["JsxClosingElement"]),
    syntax_52: syntaxReader<Hir.JsxOpeningFragment<Hir.CheckedPhase>>(["JsxOpeningFragment"]),
    syntax_53: syntaxReader<Hir.JsxClosingFragment<Hir.CheckedPhase>>(["JsxClosingFragment"]),
    syntax_54: syntaxReader<Hir.JsxAttributes<Hir.CheckedPhase>>(["JsxAttributes"]),
    syntax_55: syntaxReader<Hir.LiteralTypeChild<Hir.CheckedPhase>>(["BigIntLiteral","FalseKeyword","NullKeyword","TrueKeyword","NoSubstitutionTemplateLiteral","NumericLiteral","PrefixUnaryExpression","StringLiteral"]),
    syntax_56: syntaxReader<Hir.MinusToken<Hir.CheckedPhase> | Hir.PlusToken<Hir.CheckedPhase> | Hir.ReadonlyKeyword<Hir.CheckedPhase>>(["MinusToken","PlusToken","ReadonlyKeyword"]),
    syntax_57: syntaxReader<Hir.MinusToken<Hir.CheckedPhase> | Hir.PlusToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase>>(["MinusToken","PlusToken","QuestionToken"]),
    syntax_58: syntaxReader<Hir.NodeBody<Hir.CheckedPhase>>(["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","Block","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FunctionExpression","Identifier","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","FalseKeyword","ImportKeyword","NullKeyword","SuperKeyword","ThisKeyword","TrueKeyword","MetaProperty","ModuleBlock","ModuleDeclaration","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","TypeAssertionExpression","TypeOfExpression","VoidExpression","YieldExpression"]),
    syntax_59: syntaxReader<Hir.ModuleName<Hir.CheckedPhase>>(["Identifier","StringLiteral"]),
    syntax_60: syntaxReader<Hir.ExportSpecifier<Hir.CheckedPhase>>(["ExportSpecifier"]),
    syntax_61: syntaxReader<Hir.ImportSpecifier<Hir.CheckedPhase>>(["ImportSpecifier"]),
    syntax_62: syntaxReader<Hir.ObjectLiteralElementLike<Hir.CheckedPhase>>(["GetAccessor","MethodDeclaration","PropertyAssignment","SetAccessor","ShorthandPropertyAssignment","SpreadAssignment"]),
    syntax_63: syntaxReader<Hir.MemberName<Hir.CheckedPhase>>(["Identifier","PrivateIdentifier"]),
    syntax_64: syntaxReader<Hir.EqualsToken<Hir.CheckedPhase>>(["EqualsToken"]),
    syntax_65: syntaxReader<Hir.EndOfFile<Hir.CheckedPhase>>(["EndOfFile"]),
    syntax_66: syntaxReader<Hir.CaseBlock<Hir.CheckedPhase>>(["CaseBlock"]),
    syntax_67: syntaxReader<Hir.TemplateLiteral<Hir.CheckedPhase>>(["NoSubstitutionTemplateLiteral","TemplateExpression"]),
    syntax_68: syntaxReader<Hir.TemplateHead<Hir.CheckedPhase>>(["TemplateHead"]),
    syntax_69: syntaxReader<Hir.TemplateSpan<Hir.CheckedPhase>>(["TemplateSpan"]),
    syntax_70: syntaxReader<Hir.TemplateLiteralTypeSpan<Hir.CheckedPhase>>(["TemplateLiteralTypeSpan"]),
    syntax_71: syntaxReader<Hir.TemplateMiddleOrTail<Hir.CheckedPhase>>(["TemplateMiddle","TemplateTail"]),
    syntax_72: syntaxReader<Hir.CatchClause<Hir.CheckedPhase>>(["CatchClause"]),
    syntax_73: syntaxReader<Hir.AssertsKeyword<Hir.CheckedPhase>>(["AssertsKeyword"]),
    syntax_74: syntaxReader<Hir.TypePredicateParameterName<Hir.CheckedPhase>>(["Identifier","ThisType"]),
    syntax_75: syntaxReader<Hir.ExclamationToken<Hir.CheckedPhase>>(["ExclamationToken"]),
    syntax_76: syntaxReader<Hir.VariableDeclarationList<Hir.CheckedPhase>>(["VariableDeclarationList"]),
  };
  return readers;
}

export const hirModuleReader = (readers: HirTextReaders): HirReader<Hir.HirModule> => readers.record_0;

export const hirSyntaxReaders = (readers: HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> => new Map([
  ...createSyntaxGroup0(() => readers),
  ...createSyntaxGroup1(() => readers),
  ...createSyntaxGroup2(() => readers),
  ...createSyntaxGroup3(() => readers),
  ...createSyntaxGroup4(() => readers),
  ...createSyntaxGroup5(() => readers),
  ...createSyntaxGroup6(() => readers),
  ...createSyntaxGroup7(() => readers),
  ...createSyntaxGroup8(() => readers),
  ...createSyntaxGroup9(() => readers),
  ...createSyntaxGroup10(() => readers),
  ...createSyntaxGroup11(() => readers),
  ...createSyntaxGroup12(() => readers),
  ...createSyntaxGroup13(() => readers),
]);

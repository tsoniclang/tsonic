import { constructKeywordExpression, constructToken } from "./text-syntax-construction.js";
import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  TypedApplication, TypedBigInt, TypedBinary, TypedConditional, TypedConstruction, TypedDecorator, TypedInstantiation, TypedKeyword, TypedMember, TypedModuleReference, TypedName, TypedNumber, TypedObjectSpread, TypedOmission, TypedPhase, TypedPrefix, TypedProperty, TypedPropertyKey, TypedProtocolValue, TypedShorthand, TypedSpread, TypedString, TypedTemplate, TypedType, TypedUnary, TypedUpdate, TypedValue
} from "./contract.js";
import type {
  Origin
} from "../ids/contract.js";
import type {
  ArrayLiteralExpression, AsExpression, AwaitExpression, BigIntLiteral, BinaryExpression, CallExpression, ComputedPropertyName, ConditionalExpression, Decorator, DeleteExpression, ElementAccessExpression, EnumMember, ExportSpecifier, Expression, ExpressionWithTypeArguments, ExternalModuleReference, Identifier, ImportAttribute, ImportSpecifier, KeywordExpression, MetaProperty, ModifierList, NewExpression, NoSubstitutionTemplateLiteral, NodeList, NonNullExpression, NotEmittedTypeElement, NumericLiteral, ObjectLiteralElementLike, ObjectLiteralExpression, OmittedExpression, ParenthesizedExpression, PartiallyEmittedExpression, PostfixUnaryExpression, PrefixUnaryExpression, PrivateIdentifier, PropertyAccessExpression, PropertyAssignment, QualifiedName, RegularExpressionLiteral, SatisfiesExpression, ShorthandPropertyAssignment, SpreadAssignment, SpreadElement, StringLiteral, SyntaxList, SyntheticReferenceExpression, TaggedTemplateExpression, TemplateExpression, TemplateHead, TemplateLiteralTypeSpan, TemplateMiddle, TemplateSpan, TemplateTail, TextRange, Token, TypeNode, TypeOfExpression, VoidExpression, YieldExpression
} from "../ir-hir/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, syntaxReference, nullableWork, sequenceWork } from "./text-layouts.js";

export interface SyntaxValuesTextReads {
  readonly work_L_TypeNode_: TirRecordCodec<NodeList<TypeNode<TypedPhase>>>;
  readonly work_ModifierList: TirRecordCodec<ModifierList<TypedPhase>>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
  readonly work_TypedApplication: TirRecordCodec<TypedApplication>;
  readonly work_TypedBigInt: TirRecordCodec<TypedBigInt>;
  readonly work_TypedBinary: TirRecordCodec<TypedBinary>;
  readonly work_TypedConditional: TirRecordCodec<TypedConditional>;
  readonly work_TypedConstruction: TirRecordCodec<TypedConstruction>;
  readonly work_TypedDecorator: TirRecordCodec<TypedDecorator>;
  readonly work_TypedInstantiation: TirRecordCodec<TypedInstantiation>;
  readonly work_TypedKeyword: TirRecordCodec<TypedKeyword>;
  readonly work_TypedMember: TirRecordCodec<TypedMember>;
  readonly work_TypedModuleReference: TirRecordCodec<TypedModuleReference>;
  readonly work_TypedName: TirRecordCodec<TypedName>;
  readonly work_TypedNumber: TirRecordCodec<TypedNumber>;
  readonly work_TypedObjectSpread: TirRecordCodec<TypedObjectSpread>;
  readonly work_TypedOmission: TirRecordCodec<TypedOmission>;
  readonly work_TypedPrefix: TirRecordCodec<TypedPrefix>;
  readonly work_TypedProperty: TirRecordCodec<TypedProperty>;
  readonly work_TypedPropertyKey: TirRecordCodec<TypedPropertyKey>;
  readonly work_TypedProtocolValue: TirRecordCodec<TypedProtocolValue>;
  readonly work_TypedShorthand: TirRecordCodec<TypedShorthand>;
  readonly work_TypedSpread: TirRecordCodec<TypedSpread>;
  readonly work_TypedString: TirRecordCodec<TypedString>;
  readonly work_TypedTemplate: TirRecordCodec<TypedTemplate>;
  readonly work_TypedType: TirRecordCodec<TypedType>;
  readonly work_TypedUnary: TirRecordCodec<TypedUnary>;
  readonly work_TypedUpdate: TirRecordCodec<TypedUpdate>;
  readonly work_TypedValue: TirRecordCodec<TypedValue>;
}

export interface SyntaxValuesTextModel {
  readonly work_SyntaxList: (value: SyntaxList<TypedPhase>) => TirTypedRecordWork;
  readonly work_Token: (value: Token<TypedPhase>) => TirTypedRecordWork;
  readonly work_Identifier: (value: Identifier<TypedPhase>) => TirTypedRecordWork;
  readonly work_PrivateIdentifier: (value: PrivateIdentifier<TypedPhase>) => TirTypedRecordWork;
  readonly work_QualifiedName: (value: QualifiedName<TypedPhase>) => TirTypedRecordWork;
  readonly work_ComputedPropertyName: (value: ComputedPropertyName<TypedPhase>) => TirTypedRecordWork;
  readonly work_Decorator: (value: Decorator<TypedPhase>) => TirTypedRecordWork;
  readonly work_NotEmittedTypeElement: (value: NotEmittedTypeElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ExternalModuleReference: (value: ExternalModuleReference<TypedPhase>) => TirTypedRecordWork;
  readonly work_OmittedExpression: (value: OmittedExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_KeywordExpression: (value: KeywordExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_StringLiteral: (value: StringLiteral<TypedPhase>) => TirTypedRecordWork;
  readonly work_NumericLiteral: (value: NumericLiteral<TypedPhase>) => TirTypedRecordWork;
  readonly work_BigIntLiteral: (value: BigIntLiteral<TypedPhase>) => TirTypedRecordWork;
  readonly work_RegularExpressionLiteral: (value: RegularExpressionLiteral<TypedPhase>) => TirTypedRecordWork;
  readonly work_NoSubstitutionTemplateLiteral: (value: NoSubstitutionTemplateLiteral<TypedPhase>) => TirTypedRecordWork;
  readonly work_BinaryExpression: (value: BinaryExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_PrefixUnaryExpression: (value: PrefixUnaryExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_PostfixUnaryExpression: (value: PostfixUnaryExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_YieldExpression: (value: YieldExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_AsExpression: (value: AsExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_SatisfiesExpression: (value: SatisfiesExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_ConditionalExpression: (value: ConditionalExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_PropertyAccessExpression: (value: PropertyAccessExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_ElementAccessExpression: (value: ElementAccessExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_CallExpression: (value: CallExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_NewExpression: (value: NewExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_MetaProperty: (value: MetaProperty<TypedPhase>) => TirTypedRecordWork;
  readonly work_NonNullExpression: (value: NonNullExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_SpreadElement: (value: SpreadElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_TemplateExpression: (value: TemplateExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_TemplateSpan: (value: TemplateSpan<TypedPhase>) => TirTypedRecordWork;
  readonly work_TaggedTemplateExpression: (value: TaggedTemplateExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_ParenthesizedExpression: (value: ParenthesizedExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_ArrayLiteralExpression: (value: ArrayLiteralExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_ObjectLiteralExpression: (value: ObjectLiteralExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_SpreadAssignment: (value: SpreadAssignment<TypedPhase>) => TirTypedRecordWork;
  readonly work_PropertyAssignment: (value: PropertyAssignment<TypedPhase>) => TirTypedRecordWork;
  readonly work_ShorthandPropertyAssignment: (value: ShorthandPropertyAssignment<TypedPhase>) => TirTypedRecordWork;
  readonly work_DeleteExpression: (value: DeleteExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeOfExpression: (value: TypeOfExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_VoidExpression: (value: VoidExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_AwaitExpression: (value: AwaitExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_ExpressionWithTypeArguments: (value: ExpressionWithTypeArguments<TypedPhase>) => TirTypedRecordWork;
  readonly work_TemplateHead: (value: TemplateHead<TypedPhase>) => TirTypedRecordWork;
  readonly work_TemplateMiddle: (value: TemplateMiddle<TypedPhase>) => TirTypedRecordWork;
  readonly work_TemplateTail: (value: TemplateTail<TypedPhase>) => TirTypedRecordWork;
  readonly work_TemplateLiteralTypeSpan: (value: TemplateLiteralTypeSpan<TypedPhase>) => TirTypedRecordWork;
  readonly work_PartiallyEmittedExpression: (value: PartiallyEmittedExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_SyntheticReferenceExpression: (value: SyntheticReferenceExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_L_EnumMember_: TirRecordCodec<NodeList<EnumMember<TypedPhase>>>;
  readonly work_L_ImportSpecifier_: TirRecordCodec<NodeList<ImportSpecifier<TypedPhase>>>;
  readonly work_L_ExportSpecifier_: TirRecordCodec<NodeList<ExportSpecifier<TypedPhase>>>;
  readonly work_L_Expression_: TirRecordCodec<NodeList<Expression<TypedPhase>>>;
  readonly work_L_TemplateSpan_: TirRecordCodec<NodeList<TemplateSpan<TypedPhase>>>;
  readonly work_L_ObjectLiteralElementLike_: TirRecordCodec<NodeList<ObjectLiteralElementLike<TypedPhase>>>;
  readonly work_L_ImportAttribute_: TirRecordCodec<NodeList<ImportAttribute<TypedPhase>>>;
}

export const createSyntaxValuesText = (kernel: TirTextKernel, read: SyntaxValuesTextReads): SyntaxValuesTextModel => {
  const { defineRecord, defineSyntaxRecord, syntaxReads, booleanReader, nullReader, stringReader } = kernel;
  const work_SyntaxList: (value: SyntaxList<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SyntaxList<TypedPhase>>("SyntaxList", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SyntaxList", literalReader<(SyntaxList<TypedPhase>)["kind"]>("'SyntaxList", ["SyntaxList"]))
    .field("children", "[$SyntaxNode]", value => sequenceWork("[$SyntaxNode]", value.children, actual => syntaxReference("$SyntaxNode", actual)), sequenceReader("[$SyntaxNode]", syntaxReads.SyntaxNode))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_children, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, children: field_children, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_Token: (value: Token<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<Token<TypedPhase>>("Token", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "PlainTokenKind", literalReader<(Token<TypedPhase>)["kind"]>("PlainTokenKind", ["Unknown","EndOfFile","SingleLineCommentTrivia","MultiLineCommentTrivia","NewLineTrivia","WhitespaceTrivia","ConflictMarkerTrivia","NonTextFileMarkerTrivia","JsxTextAllWhiteSpaces","OpenBraceToken","CloseBraceToken","OpenParenToken","CloseParenToken","OpenBracketToken","CloseBracketToken","DotToken","DotDotDotToken","SemicolonToken","CommaToken","QuestionDotToken","LessThanToken","LessThanSlashToken","GreaterThanToken","LessThanEqualsToken","GreaterThanEqualsToken","EqualsEqualsToken","ExclamationEqualsToken","EqualsEqualsEqualsToken","ExclamationEqualsEqualsToken","EqualsGreaterThanToken","PlusToken","MinusToken","AsteriskToken","AsteriskAsteriskToken","SlashToken","PercentToken","PlusPlusToken","MinusMinusToken","LessThanLessThanToken","GreaterThanGreaterThanToken","GreaterThanGreaterThanGreaterThanToken","AmpersandToken","BarToken","CaretToken","ExclamationToken","TildeToken","AmpersandAmpersandToken","BarBarToken","QuestionToken","ColonToken","AtToken","QuestionQuestionToken","BacktickToken","HashToken","EqualsToken","PlusEqualsToken","MinusEqualsToken","AsteriskEqualsToken","AsteriskAsteriskEqualsToken","SlashEqualsToken","PercentEqualsToken","LessThanLessThanEqualsToken","GreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanEqualsToken","AmpersandEqualsToken","BarEqualsToken","BarBarEqualsToken","AmpersandAmpersandEqualsToken","QuestionQuestionEqualsToken","CaretEqualsToken","JSDocCommentTextToken","BreakKeyword","CaseKeyword","CatchKeyword","ClassKeyword","ConstKeyword","ContinueKeyword","DebuggerKeyword","DefaultKeyword","DeleteKeyword","DoKeyword","ElseKeyword","EnumKeyword","ExportKeyword","ExtendsKeyword","FinallyKeyword","ForKeyword","FunctionKeyword","IfKeyword","InKeyword","InstanceOfKeyword","NewKeyword","ReturnKeyword","SwitchKeyword","ThrowKeyword","TryKeyword","TypeOfKeyword","VarKeyword","WhileKeyword","WithKeyword","ImplementsKeyword","InterfaceKeyword","LetKeyword","PackageKeyword","PrivateKeyword","ProtectedKeyword","PublicKeyword","StaticKeyword","YieldKeyword","AbstractKeyword","AccessorKeyword","AsKeyword","AssertsKeyword","AssertKeyword","AsyncKeyword","AwaitKeyword","ConstructorKeyword","DeclareKeyword","GetKeyword","ImmediateKeyword","InferKeyword","IsKeyword","KeyOfKeyword","ModuleKeyword","NamespaceKeyword","OutKeyword","ReadonlyKeyword","RequireKeyword","SatisfiesKeyword","SetKeyword","TypeKeyword","UniqueKeyword","UsingKeyword","FromKeyword","GlobalKeyword","OverrideKeyword","OfKeyword","DeferKeyword"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), constructToken));
  const work_Identifier: (value: Identifier<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<Identifier<TypedPhase>>("Identifier", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'Identifier", literalReader<(Identifier<TypedPhase>)["kind"]>("'Identifier", ["Identifier"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tsonic", "TypedName", value => read.work_TypedName.write(value.tsonic), lazyReader(() => read.work_TypedName.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_PrivateIdentifier: (value: PrivateIdentifier<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PrivateIdentifier<TypedPhase>>("PrivateIdentifier", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PrivateIdentifier", literalReader<(PrivateIdentifier<TypedPhase>)["kind"]>("'PrivateIdentifier", ["PrivateIdentifier"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tsonic", "TypedName", value => read.work_TypedName.write(value.tsonic), lazyReader(() => read.work_TypedName.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_QualifiedName: (value: QualifiedName<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<QualifiedName<TypedPhase>>("QualifiedName", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'QualifiedName", literalReader<(QualifiedName<TypedPhase>)["kind"]>("'QualifiedName", ["QualifiedName"]))
    .field("left", "$EntityName", value => syntaxReference("$EntityName", value.left), syntaxReads.EntityName)
    .field("right", "$Identifier", value => syntaxReference("$Identifier", value.right), syntaxReads.Identifier)
    .field("tsonic", "TypedName", value => read.work_TypedName.write(value.tsonic), lazyReader(() => read.work_TypedName.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_left, field_right, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, left: field_left, right: field_right, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ComputedPropertyName: (value: ComputedPropertyName<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ComputedPropertyName<TypedPhase>>("ComputedPropertyName", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ComputedPropertyName", literalReader<(ComputedPropertyName<TypedPhase>)["kind"]>("'ComputedPropertyName", ["ComputedPropertyName"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedPropertyKey", value => read.work_TypedPropertyKey.write(value.tsonic), lazyReader(() => read.work_TypedPropertyKey.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_Decorator: (value: Decorator<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<Decorator<TypedPhase>>("Decorator", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'Decorator", literalReader<(Decorator<TypedPhase>)["kind"]>("'Decorator", ["Decorator"]))
    .field("expression", "$LeftHandSideExpression", value => syntaxReference("$LeftHandSideExpression", value.expression), syntaxReads.LeftHandSideExpression)
    .field("tsonic", "TypedDecorator", value => read.work_TypedDecorator.write(value.tsonic), lazyReader(() => read.work_TypedDecorator.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_NotEmittedTypeElement: (value: NotEmittedTypeElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NotEmittedTypeElement<TypedPhase>>("NotEmittedTypeElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NotEmittedTypeElement", literalReader<(NotEmittedTypeElement<TypedPhase>)["kind"]>("'NotEmittedTypeElement", ["NotEmittedTypeElement"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ExternalModuleReference: (value: ExternalModuleReference<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ExternalModuleReference<TypedPhase>>("ExternalModuleReference", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ExternalModuleReference", literalReader<(ExternalModuleReference<TypedPhase>)["kind"]>("'ExternalModuleReference", ["ExternalModuleReference"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedModuleReference", value => read.work_TypedModuleReference.write(value.tsonic), lazyReader(() => read.work_TypedModuleReference.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_OmittedExpression: (value: OmittedExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<OmittedExpression<TypedPhase>>("OmittedExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'OmittedExpression", literalReader<(OmittedExpression<TypedPhase>)["kind"]>("'OmittedExpression", ["OmittedExpression"]))
    .field("tsonic", "TypedOmission", value => read.work_TypedOmission.write(value.tsonic), lazyReader(() => read.work_TypedOmission.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_KeywordExpression: (value: KeywordExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<KeywordExpression<TypedPhase>>("KeywordExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "KeywordExpressionKind", literalReader<(KeywordExpression<TypedPhase>)["kind"]>("KeywordExpressionKind", ["NullKeyword","TrueKeyword","FalseKeyword","ThisKeyword","SuperKeyword","ImportKeyword"]))
    .field("tsonic", "TypedKeyword", value => read.work_TypedKeyword.write(value.tsonic), lazyReader(() => read.work_TypedKeyword.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), constructKeywordExpression));
  const work_StringLiteral: (value: StringLiteral<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<StringLiteral<TypedPhase>>("StringLiteral", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'StringLiteral", literalReader<(StringLiteral<TypedPhase>)["kind"]>("'StringLiteral", ["StringLiteral"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((StringLiteral<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "TypedString", value => read.work_TypedString.write(value.tsonic), lazyReader(() => read.work_TypedString.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_NumericLiteral: (value: NumericLiteral<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NumericLiteral<TypedPhase>>("NumericLiteral", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NumericLiteral", literalReader<(NumericLiteral<TypedPhase>)["kind"]>("'NumericLiteral", ["NumericLiteral"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((NumericLiteral<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "TypedNumber", value => read.work_TypedNumber.write(value.tsonic), lazyReader(() => read.work_TypedNumber.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_BigIntLiteral: (value: BigIntLiteral<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<BigIntLiteral<TypedPhase>>("BigIntLiteral", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'BigIntLiteral", literalReader<(BigIntLiteral<TypedPhase>)["kind"]>("'BigIntLiteral", ["BigIntLiteral"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((BigIntLiteral<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "TypedBigInt", value => read.work_TypedBigInt.write(value.tsonic), lazyReader(() => read.work_TypedBigInt.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_RegularExpressionLiteral: (value: RegularExpressionLiteral<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<RegularExpressionLiteral<TypedPhase>>("RegularExpressionLiteral", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'RegularExpressionLiteral", literalReader<(RegularExpressionLiteral<TypedPhase>)["kind"]>("'RegularExpressionLiteral", ["RegularExpressionLiteral"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((RegularExpressionLiteral<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "TypedValue", value => read.work_TypedValue.write(value.tsonic), lazyReader(() => read.work_TypedValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_NoSubstitutionTemplateLiteral: (value: NoSubstitutionTemplateLiteral<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NoSubstitutionTemplateLiteral<TypedPhase>>("NoSubstitutionTemplateLiteral", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NoSubstitutionTemplateLiteral", literalReader<(NoSubstitutionTemplateLiteral<TypedPhase>)["kind"]>("'NoSubstitutionTemplateLiteral", ["NoSubstitutionTemplateLiteral"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((NoSubstitutionTemplateLiteral<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("rawText", "string", value => scalarWork("string", value.rawText), stringReader)
    .field("templateFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.templateFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((NoSubstitutionTemplateLiteral<TypedPhase>)["templateFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "TypedString", value => read.work_TypedString.write(value.tsonic), lazyReader(() => read.work_TypedString.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, rawText: field_rawText,
      templateFlags: field_templateFlags, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_BinaryExpression: (value: BinaryExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<BinaryExpression<TypedPhase>>("BinaryExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'BinaryExpression", literalReader<(BinaryExpression<TypedPhase>)["kind"]>("'BinaryExpression", ["BinaryExpression"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("left", "$Expression", value => syntaxReference("$Expression", value.left), syntaxReads.Expression)
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("operatorToken", "$BinaryOperatorToken", value => syntaxReference("$BinaryOperatorToken", value.operatorToken), syntaxReads.BinaryOperatorToken)
    .field("right", "$Expression", value => syntaxReference("$Expression", value.right), syntaxReads.Expression)
    .field("tsonic", "TypedBinary", value => read.work_TypedBinary.write(value.tsonic), lazyReader(() => read.work_TypedBinary.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_left, field_type, field_operatorToken, field_right, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, left: field_left, type: field_type, operatorToken: field_operatorToken,
      right: field_right, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_PrefixUnaryExpression: (value: PrefixUnaryExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PrefixUnaryExpression<TypedPhase>>("PrefixUnaryExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PrefixUnaryExpression", literalReader<(PrefixUnaryExpression<TypedPhase>)["kind"]>("'PrefixUnaryExpression", ["PrefixUnaryExpression"]))
    .field("operator", "PrefixOperator", value => scalarWork("PrefixOperator", value.operator), literalReader<(PrefixUnaryExpression<TypedPhase>)["operator"]>("PrefixOperator", ["PlusToken","MinusToken","TildeToken","ExclamationToken","PlusPlusToken","MinusMinusToken"]))
    .field("operand", "$Expression", value => syntaxReference("$Expression", value.operand), syntaxReads.Expression)
    .field("tsonic", "TypedPrefix", value => read.work_TypedPrefix.write(value.tsonic), lazyReader(() => read.work_TypedPrefix.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_operator, field_operand, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, operator: field_operator, operand: field_operand, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_PostfixUnaryExpression: (value: PostfixUnaryExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PostfixUnaryExpression<TypedPhase>>("PostfixUnaryExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PostfixUnaryExpression", literalReader<(PostfixUnaryExpression<TypedPhase>)["kind"]>("'PostfixUnaryExpression", ["PostfixUnaryExpression"]))
    .field("operand", "$Expression", value => syntaxReference("$Expression", value.operand), syntaxReads.Expression)
    .field("operator", "PostfixOperator", value => scalarWork("PostfixOperator", value.operator), literalReader<(PostfixUnaryExpression<TypedPhase>)["operator"]>("PostfixOperator", ["PlusPlusToken","MinusMinusToken"]))
    .field("tsonic", "TypedUpdate", value => read.work_TypedUpdate.write(value.tsonic), lazyReader(() => read.work_TypedUpdate.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_operand, field_operator, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, operand: field_operand, operator: field_operator, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_YieldExpression: (value: YieldExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<YieldExpression<TypedPhase>>("YieldExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'YieldExpression", literalReader<(YieldExpression<TypedPhase>)["kind"]>("'YieldExpression", ["YieldExpression"]))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("expression", "?$Expression", value => nullableWork(value.expression, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedProtocolValue", value => read.work_TypedProtocolValue.write(value.tsonic), lazyReader(() => read.work_TypedProtocolValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_asteriskToken, field_expression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, asteriskToken: field_asteriskToken, expression: field_expression, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_AsExpression: (value: AsExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<AsExpression<TypedPhase>>("AsExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'AsExpression", literalReader<(AsExpression<TypedPhase>)["kind"]>("'AsExpression", ["AsExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedValue", value => read.work_TypedValue.write(value.tsonic), lazyReader(() => read.work_TypedValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_type, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_SatisfiesExpression: (value: SatisfiesExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SatisfiesExpression<TypedPhase>>("SatisfiesExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SatisfiesExpression", literalReader<(SatisfiesExpression<TypedPhase>)["kind"]>("'SatisfiesExpression", ["SatisfiesExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedValue", value => read.work_TypedValue.write(value.tsonic), lazyReader(() => read.work_TypedValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_type, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_ConditionalExpression: (value: ConditionalExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ConditionalExpression<TypedPhase>>("ConditionalExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ConditionalExpression", literalReader<(ConditionalExpression<TypedPhase>)["kind"]>("'ConditionalExpression", ["ConditionalExpression"]))
    .field("condition", "$Expression", value => syntaxReference("$Expression", value.condition), syntaxReads.Expression)
    .field("questionToken", "$QuestionToken", value => syntaxReference("$QuestionToken", value.questionToken), syntaxReads.QuestionToken)
    .field("whenTrue", "$Expression", value => syntaxReference("$Expression", value.whenTrue), syntaxReads.Expression)
    .field("colonToken", "$ColonToken", value => syntaxReference("$ColonToken", value.colonToken), syntaxReads.ColonToken)
    .field("whenFalse", "$Expression", value => syntaxReference("$Expression", value.whenFalse), syntaxReads.Expression)
    .field("tsonic", "TypedConditional", value => read.work_TypedConditional.write(value.tsonic), lazyReader(() => read.work_TypedConditional.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_condition, field_questionToken, field_whenTrue, field_colonToken, field_whenFalse, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, condition: field_condition, questionToken: field_questionToken, whenTrue: field_whenTrue,
      colonToken: field_colonToken, whenFalse: field_whenFalse, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_PropertyAccessExpression: (value: PropertyAccessExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PropertyAccessExpression<TypedPhase>>("PropertyAccessExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PropertyAccessExpression", literalReader<(PropertyAccessExpression<TypedPhase>)["kind"]>("'PropertyAccessExpression", ["PropertyAccessExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("questionDotToken", "?$QuestionDotToken", value => nullableWork(value.questionDotToken, actual => syntaxReference("$QuestionDotToken", actual)), nullableReader(syntaxReads.QuestionDotToken))
    .field("name", "$MemberName", value => syntaxReference("$MemberName", value.name), syntaxReads.MemberName)
    .field("tsonic", "TypedMember", value => read.work_TypedMember.write(value.tsonic), lazyReader(() => read.work_TypedMember.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_questionDotToken, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, questionDotToken: field_questionDotToken, name: field_name,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ElementAccessExpression: (value: ElementAccessExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ElementAccessExpression<TypedPhase>>("ElementAccessExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ElementAccessExpression", literalReader<(ElementAccessExpression<TypedPhase>)["kind"]>("'ElementAccessExpression", ["ElementAccessExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("questionDotToken", "?$QuestionDotToken", value => nullableWork(value.questionDotToken, actual => syntaxReference("$QuestionDotToken", actual)), nullableReader(syntaxReads.QuestionDotToken))
    .field("argumentExpression", "$Expression", value => syntaxReference("$Expression", value.argumentExpression), syntaxReads.Expression)
    .field("tsonic", "TypedMember", value => read.work_TypedMember.write(value.tsonic), lazyReader(() => read.work_TypedMember.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_questionDotToken, field_argumentExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, questionDotToken: field_questionDotToken,
      argumentExpression: field_argumentExpression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_CallExpression: (value: CallExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<CallExpression<TypedPhase>>("CallExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'CallExpression", literalReader<(CallExpression<TypedPhase>)["kind"]>("'CallExpression", ["CallExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("questionDotToken", "?$QuestionDotToken", value => nullableWork(value.questionDotToken, actual => syntaxReference("$QuestionDotToken", actual)), nullableReader(syntaxReads.QuestionDotToken))
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => read.work_L_TypeNode_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeNode_.reader)))
    .field("arguments", "L<Expression>", value => work_L_Expression_.write(value.arguments), lazyReader(() => work_L_Expression_.reader))
    .field("tsonic", "TypedApplication", value => read.work_TypedApplication.write(value.tsonic), lazyReader(() => read.work_TypedApplication.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_questionDotToken, field_typeArguments, field_arguments, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, questionDotToken: field_questionDotToken,
      typeArguments: field_typeArguments, arguments: field_arguments, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_NewExpression: (value: NewExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NewExpression<TypedPhase>>("NewExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NewExpression", literalReader<(NewExpression<TypedPhase>)["kind"]>("'NewExpression", ["NewExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => read.work_L_TypeNode_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeNode_.reader)))
    .field("arguments", "?L<Expression>", value => nullableWork(value.arguments, actual => work_L_Expression_.write(actual)), nullableReader(lazyReader(() => work_L_Expression_.reader)))
    .field("tsonic", "TypedApplication", value => read.work_TypedApplication.write(value.tsonic), lazyReader(() => read.work_TypedApplication.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_typeArguments, field_arguments, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, typeArguments: field_typeArguments, arguments: field_arguments,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_MetaProperty: (value: MetaProperty<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<MetaProperty<TypedPhase>>("MetaProperty", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'MetaProperty", literalReader<(MetaProperty<TypedPhase>)["kind"]>("'MetaProperty", ["MetaProperty"]))
    .field("keywordToken", "MetaKeyword", value => scalarWork("MetaKeyword", value.keywordToken), literalReader<(MetaProperty<TypedPhase>)["keywordToken"]>("MetaKeyword", ["ImportKeyword","NewKeyword"]))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("tsonic", "TypedValue", value => read.work_TypedValue.write(value.tsonic), lazyReader(() => read.work_TypedValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_keywordToken, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, keywordToken: field_keywordToken, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_NonNullExpression: (value: NonNullExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NonNullExpression<TypedPhase>>("NonNullExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NonNullExpression", literalReader<(NonNullExpression<TypedPhase>)["kind"]>("'NonNullExpression", ["NonNullExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedValue", value => read.work_TypedValue.write(value.tsonic), lazyReader(() => read.work_TypedValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_SpreadElement: (value: SpreadElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SpreadElement<TypedPhase>>("SpreadElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SpreadElement", literalReader<(SpreadElement<TypedPhase>)["kind"]>("'SpreadElement", ["SpreadElement"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedSpread", value => read.work_TypedSpread.write(value.tsonic), lazyReader(() => read.work_TypedSpread.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_TemplateExpression: (value: TemplateExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TemplateExpression<TypedPhase>>("TemplateExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TemplateExpression", literalReader<(TemplateExpression<TypedPhase>)["kind"]>("'TemplateExpression", ["TemplateExpression"]))
    .field("head", "$TemplateHead", value => syntaxReference("$TemplateHead", value.head), syntaxReads.TemplateHead)
    .field("templateSpans", "L<TemplateSpan>", value => work_L_TemplateSpan_.write(value.templateSpans), lazyReader(() => work_L_TemplateSpan_.reader))
    .field("tsonic", "TypedTemplate", value => read.work_TypedTemplate.write(value.tsonic), lazyReader(() => read.work_TypedTemplate.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_head, field_templateSpans, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, head: field_head, templateSpans: field_templateSpans, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_TemplateSpan: (value: TemplateSpan<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TemplateSpan<TypedPhase>>("TemplateSpan", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TemplateSpan", literalReader<(TemplateSpan<TypedPhase>)["kind"]>("'TemplateSpan", ["TemplateSpan"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("literal", "$TemplateMiddleOrTail", value => syntaxReference("$TemplateMiddleOrTail", value.literal), syntaxReads.TemplateMiddleOrTail)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_literal, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, literal: field_literal, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_TaggedTemplateExpression: (value: TaggedTemplateExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TaggedTemplateExpression<TypedPhase>>("TaggedTemplateExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TaggedTemplateExpression", literalReader<(TaggedTemplateExpression<TypedPhase>)["kind"]>("'TaggedTemplateExpression", ["TaggedTemplateExpression"]))
    .field("tag", "$Expression", value => syntaxReference("$Expression", value.tag), syntaxReads.Expression)
    .field("questionDotToken", "?$QuestionDotToken", value => nullableWork(value.questionDotToken, actual => syntaxReference("$QuestionDotToken", actual)), nullableReader(syntaxReads.QuestionDotToken))
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => read.work_L_TypeNode_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeNode_.reader)))
    .field("template", "$TemplateLiteral", value => syntaxReference("$TemplateLiteral", value.template), syntaxReads.TemplateLiteral)
    .field("tsonic", "TypedApplication", value => read.work_TypedApplication.write(value.tsonic), lazyReader(() => read.work_TypedApplication.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tag, field_questionDotToken, field_typeArguments, field_template, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tag: field_tag, questionDotToken: field_questionDotToken, typeArguments: field_typeArguments,
      template: field_template, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ParenthesizedExpression: (value: ParenthesizedExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ParenthesizedExpression<TypedPhase>>("ParenthesizedExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ParenthesizedExpression", literalReader<(ParenthesizedExpression<TypedPhase>)["kind"]>("'ParenthesizedExpression", ["ParenthesizedExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedValue", value => read.work_TypedValue.write(value.tsonic), lazyReader(() => read.work_TypedValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ArrayLiteralExpression: (value: ArrayLiteralExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ArrayLiteralExpression<TypedPhase>>("ArrayLiteralExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ArrayLiteralExpression", literalReader<(ArrayLiteralExpression<TypedPhase>)["kind"]>("'ArrayLiteralExpression", ["ArrayLiteralExpression"]))
    .field("elements", "L<Expression>", value => work_L_Expression_.write(value.elements), lazyReader(() => work_L_Expression_.reader))
    .field("multiLine", "boolean", value => scalarWork("boolean", value.multiLine), booleanReader)
    .field("tsonic", "TypedConstruction", value => read.work_TypedConstruction.write(value.tsonic), lazyReader(() => read.work_TypedConstruction.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_multiLine, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, elements: field_elements, multiLine: field_multiLine, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_ObjectLiteralExpression: (value: ObjectLiteralExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ObjectLiteralExpression<TypedPhase>>("ObjectLiteralExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ObjectLiteralExpression", literalReader<(ObjectLiteralExpression<TypedPhase>)["kind"]>("'ObjectLiteralExpression", ["ObjectLiteralExpression"]))
    .field("properties", "L<ObjectLiteralElementLike>", value => work_L_ObjectLiteralElementLike_.write(value.properties), lazyReader(() => work_L_ObjectLiteralElementLike_.reader))
    .field("multiLine", "boolean", value => scalarWork("boolean", value.multiLine), booleanReader)
    .field("tsonic", "TypedConstruction", value => read.work_TypedConstruction.write(value.tsonic), lazyReader(() => read.work_TypedConstruction.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_properties, field_multiLine, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, properties: field_properties, multiLine: field_multiLine, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_SpreadAssignment: (value: SpreadAssignment<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SpreadAssignment<TypedPhase>>("SpreadAssignment", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SpreadAssignment", literalReader<(SpreadAssignment<TypedPhase>)["kind"]>("'SpreadAssignment", ["SpreadAssignment"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedObjectSpread", value => read.work_TypedObjectSpread.write(value.tsonic), lazyReader(() => read.work_TypedObjectSpread.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_PropertyAssignment: (value: PropertyAssignment<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PropertyAssignment<TypedPhase>>("PropertyAssignment", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PropertyAssignment", literalReader<(PropertyAssignment<TypedPhase>)["kind"]>("'PropertyAssignment", ["PropertyAssignment"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("initializer", "$Expression", value => syntaxReference("$Expression", value.initializer), syntaxReads.Expression)
    .field("tsonic", "TypedProperty", value => read.work_TypedProperty.write(value.tsonic), lazyReader(() => read.work_TypedProperty.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken, type: field_type,
      initializer: field_initializer, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ShorthandPropertyAssignment: (value: ShorthandPropertyAssignment<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ShorthandPropertyAssignment<TypedPhase>>("ShorthandPropertyAssignment", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ShorthandPropertyAssignment", literalReader<(ShorthandPropertyAssignment<TypedPhase>)["kind"]>("'ShorthandPropertyAssignment", ["ShorthandPropertyAssignment"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("equalsToken", "?$EqualsToken", value => nullableWork(value.equalsToken, actual => syntaxReference("$EqualsToken", actual)), nullableReader(syntaxReads.EqualsToken))
    .field("objectAssignmentInitializer", "?$Expression", value => nullableWork(value.objectAssignmentInitializer, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedShorthand", value => read.work_TypedShorthand.write(value.tsonic), lazyReader(() => read.work_TypedShorthand.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_equalsToken, field_objectAssignmentInitializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken, type: field_type,
      equalsToken: field_equalsToken, objectAssignmentInitializer: field_objectAssignmentInitializer, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_DeleteExpression: (value: DeleteExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<DeleteExpression<TypedPhase>>("DeleteExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'DeleteExpression", literalReader<(DeleteExpression<TypedPhase>)["kind"]>("'DeleteExpression", ["DeleteExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedUnary", value => read.work_TypedUnary.write(value.tsonic), lazyReader(() => read.work_TypedUnary.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_TypeOfExpression: (value: TypeOfExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeOfExpression<TypedPhase>>("TypeOfExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypeOfExpression", literalReader<(TypeOfExpression<TypedPhase>)["kind"]>("'TypeOfExpression", ["TypeOfExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedUnary", value => read.work_TypedUnary.write(value.tsonic), lazyReader(() => read.work_TypedUnary.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_VoidExpression: (value: VoidExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<VoidExpression<TypedPhase>>("VoidExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'VoidExpression", literalReader<(VoidExpression<TypedPhase>)["kind"]>("'VoidExpression", ["VoidExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedUnary", value => read.work_TypedUnary.write(value.tsonic), lazyReader(() => read.work_TypedUnary.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_AwaitExpression: (value: AwaitExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<AwaitExpression<TypedPhase>>("AwaitExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'AwaitExpression", literalReader<(AwaitExpression<TypedPhase>)["kind"]>("'AwaitExpression", ["AwaitExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedProtocolValue", value => read.work_TypedProtocolValue.write(value.tsonic), lazyReader(() => read.work_TypedProtocolValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ExpressionWithTypeArguments: (value: ExpressionWithTypeArguments<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ExpressionWithTypeArguments<TypedPhase>>("ExpressionWithTypeArguments", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ExpressionWithTypeArguments", literalReader<(ExpressionWithTypeArguments<TypedPhase>)["kind"]>("'ExpressionWithTypeArguments", ["ExpressionWithTypeArguments"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => read.work_L_TypeNode_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeNode_.reader)))
    .field("tsonic", "TypedInstantiation", value => read.work_TypedInstantiation.write(value.tsonic), lazyReader(() => read.work_TypedInstantiation.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_typeArguments, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, typeArguments: field_typeArguments, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_TemplateHead: (value: TemplateHead<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TemplateHead<TypedPhase>>("TemplateHead", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TemplateHead", literalReader<(TemplateHead<TypedPhase>)["kind"]>("'TemplateHead", ["TemplateHead"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((TemplateHead<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("rawText", "string", value => scalarWork("string", value.rawText), stringReader)
    .field("templateFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.templateFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((TemplateHead<TypedPhase>)["templateFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, rawText: field_rawText,
      templateFlags: field_templateFlags, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TemplateMiddle: (value: TemplateMiddle<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TemplateMiddle<TypedPhase>>("TemplateMiddle", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TemplateMiddle", literalReader<(TemplateMiddle<TypedPhase>)["kind"]>("'TemplateMiddle", ["TemplateMiddle"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((TemplateMiddle<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("rawText", "string", value => scalarWork("string", value.rawText), stringReader)
    .field("templateFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.templateFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((TemplateMiddle<TypedPhase>)["templateFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, rawText: field_rawText,
      templateFlags: field_templateFlags, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TemplateTail: (value: TemplateTail<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TemplateTail<TypedPhase>>("TemplateTail", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TemplateTail", literalReader<(TemplateTail<TypedPhase>)["kind"]>("'TemplateTail", ["TemplateTail"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((TemplateTail<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("rawText", "string", value => scalarWork("string", value.rawText), stringReader)
    .field("templateFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.templateFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((TemplateTail<TypedPhase>)["templateFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags, rawText: field_rawText,
      templateFlags: field_templateFlags, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TemplateLiteralTypeSpan: (value: TemplateLiteralTypeSpan<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TemplateLiteralTypeSpan<TypedPhase>>("TemplateLiteralTypeSpan", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TemplateLiteralTypeSpan", literalReader<(TemplateLiteralTypeSpan<TypedPhase>)["kind"]>("'TemplateLiteralTypeSpan", ["TemplateLiteralTypeSpan"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("literal", "$TemplateMiddleOrTail", value => syntaxReference("$TemplateMiddleOrTail", value.literal), syntaxReads.TemplateMiddleOrTail)
    .field("tsonic", "TypedType", value => read.work_TypedType.write(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_literal, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, literal: field_literal, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_PartiallyEmittedExpression: (value: PartiallyEmittedExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PartiallyEmittedExpression<TypedPhase>>("PartiallyEmittedExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PartiallyEmittedExpression", literalReader<(PartiallyEmittedExpression<TypedPhase>)["kind"]>("'PartiallyEmittedExpression", ["PartiallyEmittedExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_SyntheticReferenceExpression: (value: SyntheticReferenceExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SyntheticReferenceExpression<TypedPhase>>("SyntheticReferenceExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SyntheticReferenceExpression", literalReader<(SyntheticReferenceExpression<TypedPhase>)["kind"]>("'SyntheticReferenceExpression", ["SyntheticReferenceExpression"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("thisArg", "$Expression", value => syntaxReference("$Expression", value.thisArg), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_thisArg, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, thisArg: field_thisArg, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_L_EnumMember_: TirRecordCodec<NodeList<EnumMember<TypedPhase>>> = defineRecord<NodeList<EnumMember<TypedPhase>>>("L<EnumMember>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$EnumMember]", value => sequenceWork("[$EnumMember]", value.nodes, actual => syntaxReference("$EnumMember", actual)), sequenceReader("[$EnumMember]", syntaxReads.EnumMember))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_ImportSpecifier_: TirRecordCodec<NodeList<ImportSpecifier<TypedPhase>>> = defineRecord<NodeList<ImportSpecifier<TypedPhase>>>("L<ImportSpecifier>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$ImportSpecifier]", value => sequenceWork("[$ImportSpecifier]", value.nodes, actual => syntaxReference("$ImportSpecifier", actual)), sequenceReader("[$ImportSpecifier]", syntaxReads.ImportSpecifier))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_ExportSpecifier_: TirRecordCodec<NodeList<ExportSpecifier<TypedPhase>>> = defineRecord<NodeList<ExportSpecifier<TypedPhase>>>("L<ExportSpecifier>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$ExportSpecifier]", value => sequenceWork("[$ExportSpecifier]", value.nodes, actual => syntaxReference("$ExportSpecifier", actual)), sequenceReader("[$ExportSpecifier]", syntaxReads.ExportSpecifier))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_Expression_: TirRecordCodec<NodeList<Expression<TypedPhase>>> = defineRecord<NodeList<Expression<TypedPhase>>>("L<Expression>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$Expression]", value => sequenceWork("[$Expression]", value.nodes, actual => syntaxReference("$Expression", actual)), sequenceReader("[$Expression]", syntaxReads.Expression))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_TemplateSpan_: TirRecordCodec<NodeList<TemplateSpan<TypedPhase>>> = defineRecord<NodeList<TemplateSpan<TypedPhase>>>("L<TemplateSpan>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$TemplateSpan]", value => sequenceWork("[$TemplateSpan]", value.nodes, actual => syntaxReference("$TemplateSpan", actual)), sequenceReader("[$TemplateSpan]", syntaxReads.TemplateSpan))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_ObjectLiteralElementLike_: TirRecordCodec<NodeList<ObjectLiteralElementLike<TypedPhase>>> = defineRecord<NodeList<ObjectLiteralElementLike<TypedPhase>>>("L<ObjectLiteralElementLike>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$ObjectLiteralElementLike]", value => sequenceWork("[$ObjectLiteralElementLike]", value.nodes, actual => syntaxReference("$ObjectLiteralElementLike", actual)), sequenceReader("[$ObjectLiteralElementLike]", syntaxReads.ObjectLiteralElementLike))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_ImportAttribute_: TirRecordCodec<NodeList<ImportAttribute<TypedPhase>>> = defineRecord<NodeList<ImportAttribute<TypedPhase>>>("L<ImportAttribute>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$ImportAttribute]", value => sequenceWork("[$ImportAttribute]", value.nodes, actual => syntaxReference("$ImportAttribute", actual)), sequenceReader("[$ImportAttribute]", syntaxReads.ImportAttribute))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  return { work_SyntaxList, work_Token, work_Identifier, work_PrivateIdentifier, work_QualifiedName, work_ComputedPropertyName, work_Decorator, work_NotEmittedTypeElement, work_ExternalModuleReference, work_OmittedExpression, work_KeywordExpression, work_StringLiteral, work_NumericLiteral, work_BigIntLiteral, work_RegularExpressionLiteral, work_NoSubstitutionTemplateLiteral, work_BinaryExpression, work_PrefixUnaryExpression, work_PostfixUnaryExpression, work_YieldExpression, work_AsExpression, work_SatisfiesExpression, work_ConditionalExpression, work_PropertyAccessExpression, work_ElementAccessExpression, work_CallExpression, work_NewExpression, work_MetaProperty, work_NonNullExpression, work_SpreadElement, work_TemplateExpression, work_TemplateSpan, work_TaggedTemplateExpression, work_ParenthesizedExpression, work_ArrayLiteralExpression, work_ObjectLiteralExpression, work_SpreadAssignment, work_PropertyAssignment, work_ShorthandPropertyAssignment, work_DeleteExpression, work_TypeOfExpression, work_VoidExpression, work_AwaitExpression, work_ExpressionWithTypeArguments, work_TemplateHead, work_TemplateMiddle, work_TemplateTail, work_TemplateLiteralTypeSpan, work_PartiallyEmittedExpression, work_SyntheticReferenceExpression, work_L_EnumMember_, work_L_ImportSpecifier_, work_L_ExportSpecifier_, work_L_Expression_, work_L_TemplateSpan_, work_L_ObjectLiteralElementLike_, work_L_ImportAttribute_ };
};

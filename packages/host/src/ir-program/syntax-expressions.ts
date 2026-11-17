import type {
  Identifier, PrivateIdentifier, QualifiedName, ComputedPropertyName, Decorator,
  OmittedExpression, KeywordExpression, StringLiteral, NumericLiteral, BigIntLiteral,
  RegularExpressionLiteral, NoSubstitutionTemplateLiteral, BinaryExpression, PrefixUnaryExpression, PostfixUnaryExpression,
  YieldExpression, ArrowFunction, FunctionExpression, AsExpression, SatisfiesExpression,
  ConditionalExpression, PropertyAccessExpression, ElementAccessExpression, CallExpression, NewExpression,
  MetaProperty, NonNullExpression, SpreadElement, TemplateExpression, TemplateSpan,
  TaggedTemplateExpression, ParenthesizedExpression, ArrayLiteralExpression, ObjectLiteralExpression, SpreadAssignment,
  PropertyAssignment, ShorthandPropertyAssignment, DeleteExpression, TypeOfExpression, VoidExpression,
  AwaitExpression, TypeAssertion, ExpressionWithTypeArguments, TemplateHead, TemplateMiddle,
  TemplateTail, PartiallyEmittedExpression, SyntheticReferenceExpression,
} from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./syntax-arena.js";
import { copyNodeList, memoSyntaxPlan, syntaxHeader } from "./syntax-arena.js";
import { rewriteValue } from "./canonical-tir.js";
import {
  rewriteName, rewritePropertyKey, rewriteDecorator, rewriteOmission, rewriteKeyword,
  rewriteString, rewriteNumber, rewriteBigInt, rewriteBinary, rewritePrefix,
  rewriteUpdate, rewriteProtocolValue, rewriteClosure, rewriteConditional, rewriteTypedMember,
  rewriteTypedApplication, rewriteTemplate, rewriteConstruction, rewriteObjectSpread, rewriteProperty,
  rewriteUnary, rewriteInstantiation,
} from "./canonical-phase.js";

export interface ExpressionsPlans {
  readonly Identifier: (node: Identifier<TypedPhase>) => SyntaxPlan<Identifier<TypedPhase>>;
  readonly PrivateIdentifier: (node: PrivateIdentifier<TypedPhase>) => SyntaxPlan<PrivateIdentifier<TypedPhase>>;
  readonly QualifiedName: (node: QualifiedName<TypedPhase>) => SyntaxPlan<QualifiedName<TypedPhase>>;
  readonly ComputedPropertyName: (node: ComputedPropertyName<TypedPhase>) => SyntaxPlan<ComputedPropertyName<TypedPhase>>;
  readonly Decorator: (node: Decorator<TypedPhase>) => SyntaxPlan<Decorator<TypedPhase>>;
  readonly OmittedExpression: (node: OmittedExpression<TypedPhase>) => SyntaxPlan<OmittedExpression<TypedPhase>>;
  readonly KeywordExpression: (node: KeywordExpression<TypedPhase>) => SyntaxPlan<KeywordExpression<TypedPhase>>;
  readonly StringLiteral: (node: StringLiteral<TypedPhase>) => SyntaxPlan<StringLiteral<TypedPhase>>;
  readonly NumericLiteral: (node: NumericLiteral<TypedPhase>) => SyntaxPlan<NumericLiteral<TypedPhase>>;
  readonly BigIntLiteral: (node: BigIntLiteral<TypedPhase>) => SyntaxPlan<BigIntLiteral<TypedPhase>>;
  readonly RegularExpressionLiteral: (node: RegularExpressionLiteral<TypedPhase>) => SyntaxPlan<RegularExpressionLiteral<TypedPhase>>;
  readonly NoSubstitutionTemplateLiteral: (node: NoSubstitutionTemplateLiteral<TypedPhase>) => SyntaxPlan<NoSubstitutionTemplateLiteral<TypedPhase>>;
  readonly BinaryExpression: (node: BinaryExpression<TypedPhase>) => SyntaxPlan<BinaryExpression<TypedPhase>>;
  readonly PrefixUnaryExpression: (node: PrefixUnaryExpression<TypedPhase>) => SyntaxPlan<PrefixUnaryExpression<TypedPhase>>;
  readonly PostfixUnaryExpression: (node: PostfixUnaryExpression<TypedPhase>) => SyntaxPlan<PostfixUnaryExpression<TypedPhase>>;
  readonly YieldExpression: (node: YieldExpression<TypedPhase>) => SyntaxPlan<YieldExpression<TypedPhase>>;
  readonly ArrowFunction: (node: ArrowFunction<TypedPhase>) => SyntaxPlan<ArrowFunction<TypedPhase>>;
  readonly FunctionExpression: (node: FunctionExpression<TypedPhase>) => SyntaxPlan<FunctionExpression<TypedPhase>>;
  readonly AsExpression: (node: AsExpression<TypedPhase>) => SyntaxPlan<AsExpression<TypedPhase>>;
  readonly SatisfiesExpression: (node: SatisfiesExpression<TypedPhase>) => SyntaxPlan<SatisfiesExpression<TypedPhase>>;
  readonly ConditionalExpression: (node: ConditionalExpression<TypedPhase>) => SyntaxPlan<ConditionalExpression<TypedPhase>>;
  readonly PropertyAccessExpression: (node: PropertyAccessExpression<TypedPhase>) => SyntaxPlan<PropertyAccessExpression<TypedPhase>>;
  readonly ElementAccessExpression: (node: ElementAccessExpression<TypedPhase>) => SyntaxPlan<ElementAccessExpression<TypedPhase>>;
  readonly CallExpression: (node: CallExpression<TypedPhase>) => SyntaxPlan<CallExpression<TypedPhase>>;
  readonly NewExpression: (node: NewExpression<TypedPhase>) => SyntaxPlan<NewExpression<TypedPhase>>;
  readonly MetaProperty: (node: MetaProperty<TypedPhase>) => SyntaxPlan<MetaProperty<TypedPhase>>;
  readonly NonNullExpression: (node: NonNullExpression<TypedPhase>) => SyntaxPlan<NonNullExpression<TypedPhase>>;
  readonly SpreadElement: (node: SpreadElement<TypedPhase>) => SyntaxPlan<SpreadElement<TypedPhase>>;
  readonly TemplateExpression: (node: TemplateExpression<TypedPhase>) => SyntaxPlan<TemplateExpression<TypedPhase>>;
  readonly TemplateSpan: (node: TemplateSpan<TypedPhase>) => SyntaxPlan<TemplateSpan<TypedPhase>>;
  readonly TaggedTemplateExpression: (node: TaggedTemplateExpression<TypedPhase>) => SyntaxPlan<TaggedTemplateExpression<TypedPhase>>;
  readonly ParenthesizedExpression: (node: ParenthesizedExpression<TypedPhase>) => SyntaxPlan<ParenthesizedExpression<TypedPhase>>;
  readonly ArrayLiteralExpression: (node: ArrayLiteralExpression<TypedPhase>) => SyntaxPlan<ArrayLiteralExpression<TypedPhase>>;
  readonly ObjectLiteralExpression: (node: ObjectLiteralExpression<TypedPhase>) => SyntaxPlan<ObjectLiteralExpression<TypedPhase>>;
  readonly SpreadAssignment: (node: SpreadAssignment<TypedPhase>) => SyntaxPlan<SpreadAssignment<TypedPhase>>;
  readonly PropertyAssignment: (node: PropertyAssignment<TypedPhase>) => SyntaxPlan<PropertyAssignment<TypedPhase>>;
  readonly ShorthandPropertyAssignment: (node: ShorthandPropertyAssignment<TypedPhase>) => SyntaxPlan<ShorthandPropertyAssignment<TypedPhase>>;
  readonly DeleteExpression: (node: DeleteExpression<TypedPhase>) => SyntaxPlan<DeleteExpression<TypedPhase>>;
  readonly TypeOfExpression: (node: TypeOfExpression<TypedPhase>) => SyntaxPlan<TypeOfExpression<TypedPhase>>;
  readonly VoidExpression: (node: VoidExpression<TypedPhase>) => SyntaxPlan<VoidExpression<TypedPhase>>;
  readonly AwaitExpression: (node: AwaitExpression<TypedPhase>) => SyntaxPlan<AwaitExpression<TypedPhase>>;
  readonly TypeAssertion: (node: TypeAssertion<TypedPhase>) => SyntaxPlan<TypeAssertion<TypedPhase>>;
  readonly ExpressionWithTypeArguments: (node: ExpressionWithTypeArguments<TypedPhase>) => SyntaxPlan<ExpressionWithTypeArguments<TypedPhase>>;
  readonly TemplateHead: (node: TemplateHead<TypedPhase>) => SyntaxPlan<TemplateHead<TypedPhase>>;
  readonly TemplateMiddle: (node: TemplateMiddle<TypedPhase>) => SyntaxPlan<TemplateMiddle<TypedPhase>>;
  readonly TemplateTail: (node: TemplateTail<TypedPhase>) => SyntaxPlan<TemplateTail<TypedPhase>>;
  readonly PartiallyEmittedExpression: (node: PartiallyEmittedExpression<TypedPhase>) => SyntaxPlan<PartiallyEmittedExpression<TypedPhase>>;
  readonly SyntheticReferenceExpression: (node: SyntheticReferenceExpression<TypedPhase>) => SyntaxPlan<SyntheticReferenceExpression<TypedPhase>>;
  readonly LiteralKeywordExpression: (node: KeywordExpression<TypedPhase, "TrueKeyword" | "FalseKeyword" | "NullKeyword">) => SyntaxPlan<KeywordExpression<TypedPhase, "TrueKeyword" | "FalseKeyword" | "NullKeyword">>;
}

export function createExpressionsPlans(rewrite: TypeRewrite, ports: () => SyntaxCopyPorts, at: string): ExpressionsPlans {
  const Identifier = new Map<Identifier<TypedPhase>, SyntaxPlan<Identifier<TypedPhase>>>();
  const PrivateIdentifier = new Map<PrivateIdentifier<TypedPhase>, SyntaxPlan<PrivateIdentifier<TypedPhase>>>();
  const QualifiedName = new Map<QualifiedName<TypedPhase>, SyntaxPlan<QualifiedName<TypedPhase>>>();
  const ComputedPropertyName = new Map<ComputedPropertyName<TypedPhase>, SyntaxPlan<ComputedPropertyName<TypedPhase>>>();
  const Decorator = new Map<Decorator<TypedPhase>, SyntaxPlan<Decorator<TypedPhase>>>();
  const OmittedExpression = new Map<OmittedExpression<TypedPhase>, SyntaxPlan<OmittedExpression<TypedPhase>>>();
  const StringLiteral = new Map<StringLiteral<TypedPhase>, SyntaxPlan<StringLiteral<TypedPhase>>>();
  const NumericLiteral = new Map<NumericLiteral<TypedPhase>, SyntaxPlan<NumericLiteral<TypedPhase>>>();
  const BigIntLiteral = new Map<BigIntLiteral<TypedPhase>, SyntaxPlan<BigIntLiteral<TypedPhase>>>();
  const RegularExpressionLiteral = new Map<RegularExpressionLiteral<TypedPhase>, SyntaxPlan<RegularExpressionLiteral<TypedPhase>>>();
  const NoSubstitutionTemplateLiteral = new Map<NoSubstitutionTemplateLiteral<TypedPhase>, SyntaxPlan<NoSubstitutionTemplateLiteral<TypedPhase>>>();
  const BinaryExpression = new Map<BinaryExpression<TypedPhase>, SyntaxPlan<BinaryExpression<TypedPhase>>>();
  const PrefixUnaryExpression = new Map<PrefixUnaryExpression<TypedPhase>, SyntaxPlan<PrefixUnaryExpression<TypedPhase>>>();
  const PostfixUnaryExpression = new Map<PostfixUnaryExpression<TypedPhase>, SyntaxPlan<PostfixUnaryExpression<TypedPhase>>>();
  const YieldExpression = new Map<YieldExpression<TypedPhase>, SyntaxPlan<YieldExpression<TypedPhase>>>();
  const ArrowFunction = new Map<ArrowFunction<TypedPhase>, SyntaxPlan<ArrowFunction<TypedPhase>>>();
  const FunctionExpression = new Map<FunctionExpression<TypedPhase>, SyntaxPlan<FunctionExpression<TypedPhase>>>();
  const AsExpression = new Map<AsExpression<TypedPhase>, SyntaxPlan<AsExpression<TypedPhase>>>();
  const SatisfiesExpression = new Map<SatisfiesExpression<TypedPhase>, SyntaxPlan<SatisfiesExpression<TypedPhase>>>();
  const ConditionalExpression = new Map<ConditionalExpression<TypedPhase>, SyntaxPlan<ConditionalExpression<TypedPhase>>>();
  const PropertyAccessExpression = new Map<PropertyAccessExpression<TypedPhase>, SyntaxPlan<PropertyAccessExpression<TypedPhase>>>();
  const ElementAccessExpression = new Map<ElementAccessExpression<TypedPhase>, SyntaxPlan<ElementAccessExpression<TypedPhase>>>();
  const CallExpression = new Map<CallExpression<TypedPhase>, SyntaxPlan<CallExpression<TypedPhase>>>();
  const NewExpression = new Map<NewExpression<TypedPhase>, SyntaxPlan<NewExpression<TypedPhase>>>();
  const MetaProperty = new Map<MetaProperty<TypedPhase>, SyntaxPlan<MetaProperty<TypedPhase>>>();
  const NonNullExpression = new Map<NonNullExpression<TypedPhase>, SyntaxPlan<NonNullExpression<TypedPhase>>>();
  const SpreadElement = new Map<SpreadElement<TypedPhase>, SyntaxPlan<SpreadElement<TypedPhase>>>();
  const TemplateExpression = new Map<TemplateExpression<TypedPhase>, SyntaxPlan<TemplateExpression<TypedPhase>>>();
  const TemplateSpan = new Map<TemplateSpan<TypedPhase>, SyntaxPlan<TemplateSpan<TypedPhase>>>();
  const TaggedTemplateExpression = new Map<TaggedTemplateExpression<TypedPhase>, SyntaxPlan<TaggedTemplateExpression<TypedPhase>>>();
  const ParenthesizedExpression = new Map<ParenthesizedExpression<TypedPhase>, SyntaxPlan<ParenthesizedExpression<TypedPhase>>>();
  const ArrayLiteralExpression = new Map<ArrayLiteralExpression<TypedPhase>, SyntaxPlan<ArrayLiteralExpression<TypedPhase>>>();
  const ObjectLiteralExpression = new Map<ObjectLiteralExpression<TypedPhase>, SyntaxPlan<ObjectLiteralExpression<TypedPhase>>>();
  const SpreadAssignment = new Map<SpreadAssignment<TypedPhase>, SyntaxPlan<SpreadAssignment<TypedPhase>>>();
  const PropertyAssignment = new Map<PropertyAssignment<TypedPhase>, SyntaxPlan<PropertyAssignment<TypedPhase>>>();
  const ShorthandPropertyAssignment = new Map<ShorthandPropertyAssignment<TypedPhase>, SyntaxPlan<ShorthandPropertyAssignment<TypedPhase>>>();
  const DeleteExpression = new Map<DeleteExpression<TypedPhase>, SyntaxPlan<DeleteExpression<TypedPhase>>>();
  const TypeOfExpression = new Map<TypeOfExpression<TypedPhase>, SyntaxPlan<TypeOfExpression<TypedPhase>>>();
  const VoidExpression = new Map<VoidExpression<TypedPhase>, SyntaxPlan<VoidExpression<TypedPhase>>>();
  const AwaitExpression = new Map<AwaitExpression<TypedPhase>, SyntaxPlan<AwaitExpression<TypedPhase>>>();
  const TypeAssertion = new Map<TypeAssertion<TypedPhase>, SyntaxPlan<TypeAssertion<TypedPhase>>>();
  const ExpressionWithTypeArguments = new Map<ExpressionWithTypeArguments<TypedPhase>, SyntaxPlan<ExpressionWithTypeArguments<TypedPhase>>>();
  const TemplateHead = new Map<TemplateHead<TypedPhase>, SyntaxPlan<TemplateHead<TypedPhase>>>();
  const TemplateMiddle = new Map<TemplateMiddle<TypedPhase>, SyntaxPlan<TemplateMiddle<TypedPhase>>>();
  const TemplateTail = new Map<TemplateTail<TypedPhase>, SyntaxPlan<TemplateTail<TypedPhase>>>();
  const PartiallyEmittedExpression = new Map<PartiallyEmittedExpression<TypedPhase>, SyntaxPlan<PartiallyEmittedExpression<TypedPhase>>>();
  const SyntheticReferenceExpression = new Map<SyntheticReferenceExpression<TypedPhase>, SyntaxPlan<SyntheticReferenceExpression<TypedPhase>>>();
  const NullKeyword = new Map<KeywordExpression<TypedPhase>, SyntaxPlan<KeywordExpression<TypedPhase, "NullKeyword">>>();
  const TrueKeyword = new Map<KeywordExpression<TypedPhase>, SyntaxPlan<KeywordExpression<TypedPhase, "TrueKeyword">>>();
  const FalseKeyword = new Map<KeywordExpression<TypedPhase>, SyntaxPlan<KeywordExpression<TypedPhase, "FalseKeyword">>>();
  const ThisKeyword = new Map<KeywordExpression<TypedPhase>, SyntaxPlan<KeywordExpression<TypedPhase, "ThisKeyword">>>();
  const SuperKeyword = new Map<KeywordExpression<TypedPhase>, SyntaxPlan<KeywordExpression<TypedPhase, "SuperKeyword">>>();
  const ImportKeyword = new Map<KeywordExpression<TypedPhase>, SyntaxPlan<KeywordExpression<TypedPhase, "ImportKeyword">>>();
  const keyword = (node: KeywordExpression<TypedPhase>) => rewriteKeyword(rewrite, node.tsonic, at + ".KeywordExpression.tsonic");
  const literalKeyword = (node: KeywordExpression<TypedPhase>, kind: "TrueKeyword" | "FalseKeyword" | "NullKeyword"): SyntaxPlan<KeywordExpression<TypedPhase, "TrueKeyword" | "FalseKeyword" | "NullKeyword">> => {
    switch (kind) {
      case "TrueKeyword": return memoSyntaxPlan(TrueKeyword, node, () => ({ ...syntaxHeader(node), kind: "TrueKeyword", tsonic: keyword(node) }));
      case "FalseKeyword": return memoSyntaxPlan(FalseKeyword, node, () => ({ ...syntaxHeader(node), kind: "FalseKeyword", tsonic: keyword(node) }));
      case "NullKeyword": return memoSyntaxPlan(NullKeyword, node, () => ({ ...syntaxHeader(node), kind: "NullKeyword", tsonic: keyword(node) }));
    }
  };
  return {
    Identifier: node => memoSyntaxPlan(Identifier, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tsonic: rewriteName(rewrite, node.tsonic, at + ".Identifier.tsonic"),
    })),
    PrivateIdentifier: node => memoSyntaxPlan(PrivateIdentifier, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tsonic: rewriteName(rewrite, node.tsonic, at + ".PrivateIdentifier.tsonic"),
    })),
    QualifiedName: node => memoSyntaxPlan(QualifiedName, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      left: ports().EntityName(node.left)(),
      right: ports().Identifier(node.right)(),
      tsonic: rewriteName(rewrite, node.tsonic, at + ".QualifiedName.tsonic"),
    })),
    ComputedPropertyName: node => memoSyntaxPlan(ComputedPropertyName, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewritePropertyKey(rewrite, node.tsonic),
    })),
    Decorator: node => memoSyntaxPlan(Decorator, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().LeftHandSideExpression(node.expression)(),
      tsonic: rewriteDecorator(rewrite, node.tsonic, at + ".Decorator.tsonic"),
    })),
    OmittedExpression: node => memoSyntaxPlan(OmittedExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: rewriteOmission(rewrite, node.tsonic),
    })),
    KeywordExpression: node => {
      switch (node.kind) {
        case "NullKeyword":
        case "TrueKeyword":
        case "FalseKeyword": return literalKeyword(node, node.kind);
        case "ThisKeyword": return memoSyntaxPlan(ThisKeyword, node, () => ({ ...syntaxHeader(node), kind: "ThisKeyword", tsonic: keyword(node) }));
        case "SuperKeyword": return memoSyntaxPlan(SuperKeyword, node, () => ({ ...syntaxHeader(node), kind: "SuperKeyword", tsonic: keyword(node) }));
        case "ImportKeyword": return memoSyntaxPlan(ImportKeyword, node, () => ({ ...syntaxHeader(node), kind: "ImportKeyword", tsonic: keyword(node) }));
      }
    },
    StringLiteral: node => memoSyntaxPlan(StringLiteral, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      tsonic: rewriteString(rewrite, node.tsonic, at + ".StringLiteral.tsonic"),
    })),
    NumericLiteral: node => memoSyntaxPlan(NumericLiteral, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      tsonic: rewriteNumber(rewrite, node.tsonic, at + ".NumericLiteral.tsonic"),
    })),
    BigIntLiteral: node => memoSyntaxPlan(BigIntLiteral, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      tsonic: rewriteBigInt(rewrite, node.tsonic, at + ".BigIntLiteral.tsonic"),
    })),
    RegularExpressionLiteral: node => memoSyntaxPlan(RegularExpressionLiteral, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      tsonic: rewriteValue(rewrite, node.tsonic, at + ".RegularExpressionLiteral.tsonic"),
    })),
    NoSubstitutionTemplateLiteral: node => memoSyntaxPlan(NoSubstitutionTemplateLiteral, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      rawText: node.rawText,
      templateFlags: node.templateFlags,
      tsonic: rewriteString(rewrite, node.tsonic, at + ".NoSubstitutionTemplateLiteral.tsonic"),
    })),
    BinaryExpression: node => memoSyntaxPlan(BinaryExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      left: ports().Expression(node.left)(),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      operatorToken: node.operatorToken,
      right: ports().Expression(node.right)(),
      tsonic: rewriteBinary(rewrite, node.tsonic, at + ".BinaryExpression.tsonic"),
    })),
    PrefixUnaryExpression: node => memoSyntaxPlan(PrefixUnaryExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      operator: node.operator,
      operand: ports().Expression(node.operand)(),
      tsonic: rewritePrefix(rewrite, node.tsonic, at + ".PrefixUnaryExpression.tsonic"),
    })),
    PostfixUnaryExpression: node => memoSyntaxPlan(PostfixUnaryExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      operand: ports().Expression(node.operand)(),
      operator: node.operator,
      tsonic: rewriteUpdate(rewrite, node.tsonic, at + ".PostfixUnaryExpression.tsonic"),
    })),
    YieldExpression: node => memoSyntaxPlan(YieldExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      asteriskToken: node.asteriskToken,
      expression: node.expression === null ? null : ports().Expression(node.expression)(),
      tsonic: rewriteProtocolValue(rewrite, node.tsonic, at + ".YieldExpression.tsonic"),
    })),
    ArrowFunction: node => memoSyntaxPlan(ArrowFunction, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().BlockOrExpression(node.body)(),
      equalsGreaterThanToken: node.equalsGreaterThanToken,
      tsonic: rewriteClosure(rewrite, node.tsonic, at + ".ArrowFunction.tsonic"),
    })),
    FunctionExpression: node => memoSyntaxPlan(FunctionExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().BlockOrExpression(node.body)(),
      name: node.name === null ? null : ports().Identifier(node.name)(),
      tsonic: rewriteClosure(rewrite, node.tsonic, at + ".FunctionExpression.tsonic"),
    })),
    AsExpression: node => memoSyntaxPlan(AsExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteValue(rewrite, node.tsonic, at + ".AsExpression.tsonic"),
    })),
    SatisfiesExpression: node => memoSyntaxPlan(SatisfiesExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteValue(rewrite, node.tsonic, at + ".SatisfiesExpression.tsonic"),
    })),
    ConditionalExpression: node => memoSyntaxPlan(ConditionalExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      condition: ports().Expression(node.condition)(),
      questionToken: node.questionToken,
      whenTrue: ports().Expression(node.whenTrue)(),
      colonToken: node.colonToken,
      whenFalse: ports().Expression(node.whenFalse)(),
      tsonic: rewriteConditional(rewrite, node.tsonic, at + ".ConditionalExpression.tsonic"),
    })),
    PropertyAccessExpression: node => memoSyntaxPlan(PropertyAccessExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      questionDotToken: node.questionDotToken,
      name: ports().MemberName(node.name)(),
      tsonic: rewriteTypedMember(rewrite, node.tsonic, at + ".PropertyAccessExpression.tsonic"),
    })),
    ElementAccessExpression: node => memoSyntaxPlan(ElementAccessExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      questionDotToken: node.questionDotToken,
      argumentExpression: ports().Expression(node.argumentExpression)(),
      tsonic: rewriteTypedMember(rewrite, node.tsonic, at + ".ElementAccessExpression.tsonic"),
    })),
    CallExpression: node => memoSyntaxPlan(CallExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      questionDotToken: node.questionDotToken,
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      arguments: copyNodeList(node.arguments, item => ports().Expression(item)()),
      tsonic: rewriteTypedApplication(rewrite, node.tsonic, at + ".CallExpression.tsonic"),
    })),
    NewExpression: node => memoSyntaxPlan(NewExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      arguments: node.arguments === null ? null : copyNodeList(node.arguments, item => ports().Expression(item)()),
      tsonic: rewriteTypedApplication(rewrite, node.tsonic, at + ".NewExpression.tsonic"),
    })),
    MetaProperty: node => memoSyntaxPlan(MetaProperty, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      keywordToken: node.keywordToken,
      name: ports().Identifier(node.name)(),
      tsonic: rewriteValue(rewrite, node.tsonic, at + ".MetaProperty.tsonic"),
    })),
    NonNullExpression: node => memoSyntaxPlan(NonNullExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteValue(rewrite, node.tsonic, at + ".NonNullExpression.tsonic"),
    })),
    SpreadElement: node => memoSyntaxPlan(SpreadElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteProtocolValue(rewrite, node.tsonic, at + ".SpreadElement.tsonic"),
    })),
    TemplateExpression: node => memoSyntaxPlan(TemplateExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      head: ports().TemplateHead(node.head)(),
      templateSpans: copyNodeList(node.templateSpans, item => ports().TemplateSpan(item)()),
      tsonic: rewriteTemplate(rewrite, node.tsonic, at + ".TemplateExpression.tsonic"),
    })),
    TemplateSpan: node => memoSyntaxPlan(TemplateSpan, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      literal: ports().TemplateMiddleOrTail(node.literal)(),
      tsonic: node.tsonic,
    })),
    TaggedTemplateExpression: node => memoSyntaxPlan(TaggedTemplateExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tag: ports().Expression(node.tag)(),
      questionDotToken: node.questionDotToken,
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      template: ports().TemplateLiteral(node.template)(),
      tsonic: rewriteTypedApplication(rewrite, node.tsonic, at + ".TaggedTemplateExpression.tsonic"),
    })),
    ParenthesizedExpression: node => memoSyntaxPlan(ParenthesizedExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteValue(rewrite, node.tsonic, at + ".ParenthesizedExpression.tsonic"),
    })),
    ArrayLiteralExpression: node => memoSyntaxPlan(ArrayLiteralExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elements: copyNodeList(node.elements, item => ports().Expression(item)()),
      multiLine: node.multiLine,
      tsonic: rewriteConstruction(rewrite, node.tsonic, at + ".ArrayLiteralExpression.tsonic"),
    })),
    ObjectLiteralExpression: node => memoSyntaxPlan(ObjectLiteralExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      properties: copyNodeList(node.properties, item => ports().ObjectLiteralElementLike(item)()),
      multiLine: node.multiLine,
      tsonic: rewriteConstruction(rewrite, node.tsonic, at + ".ObjectLiteralExpression.tsonic"),
    })),
    SpreadAssignment: node => memoSyntaxPlan(SpreadAssignment, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteObjectSpread(rewrite, node.tsonic, at + ".SpreadAssignment.tsonic"),
    })),
    PropertyAssignment: node => memoSyntaxPlan(PropertyAssignment, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      initializer: ports().Expression(node.initializer)(),
      tsonic: rewriteProperty(rewrite, node.tsonic, at + ".PropertyAssignment.tsonic"),
    })),
    ShorthandPropertyAssignment: node => memoSyntaxPlan(ShorthandPropertyAssignment, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      equalsToken: node.equalsToken,
      objectAssignmentInitializer: node.objectAssignmentInitializer === null ? null : ports().Expression(node.objectAssignmentInitializer)(),
      tsonic: rewriteProperty(rewrite, node.tsonic, at + ".ShorthandPropertyAssignment.tsonic"),
    })),
    DeleteExpression: node => memoSyntaxPlan(DeleteExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteUnary(rewrite, node.tsonic, at + ".DeleteExpression.tsonic"),
    })),
    TypeOfExpression: node => memoSyntaxPlan(TypeOfExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteUnary(rewrite, node.tsonic, at + ".TypeOfExpression.tsonic"),
    })),
    VoidExpression: node => memoSyntaxPlan(VoidExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteUnary(rewrite, node.tsonic, at + ".VoidExpression.tsonic"),
    })),
    AwaitExpression: node => memoSyntaxPlan(AwaitExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteProtocolValue(rewrite, node.tsonic, at + ".AwaitExpression.tsonic"),
    })),
    TypeAssertion: node => memoSyntaxPlan(TypeAssertion, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      expression: ports().Expression(node.expression)(),
      tsonic: rewriteValue(rewrite, node.tsonic, at + ".TypeAssertion.tsonic"),
    })),
    ExpressionWithTypeArguments: node => memoSyntaxPlan(ExpressionWithTypeArguments, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      tsonic: rewriteInstantiation(rewrite, node.tsonic, at + ".ExpressionWithTypeArguments.tsonic"),
    })),
    TemplateHead: node => memoSyntaxPlan(TemplateHead, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      rawText: node.rawText,
      templateFlags: node.templateFlags,
      tsonic: node.tsonic,
    })),
    TemplateMiddle: node => memoSyntaxPlan(TemplateMiddle, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      rawText: node.rawText,
      templateFlags: node.templateFlags,
      tsonic: node.tsonic,
    })),
    TemplateTail: node => memoSyntaxPlan(TemplateTail, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      rawText: node.rawText,
      templateFlags: node.templateFlags,
      tsonic: node.tsonic,
    })),
    PartiallyEmittedExpression: node => memoSyntaxPlan(PartiallyEmittedExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    SyntheticReferenceExpression: node => memoSyntaxPlan(SyntheticReferenceExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      thisArg: ports().Expression(node.thisArg)(),
      tsonic: node.tsonic,
    })),
    LiteralKeywordExpression: node => literalKeyword(node, node.kind),
  };
}

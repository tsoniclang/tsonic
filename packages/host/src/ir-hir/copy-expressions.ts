import type {
  Identifier, PrivateIdentifier, QualifiedName, ComputedPropertyName, Decorator,
  OmittedExpression, KeywordExpression, StringLiteral, NumericLiteral, BigIntLiteral,
  RegularExpressionLiteral, NoSubstitutionTemplateLiteral, BinaryExpression, BinarySyntaxReceipt, PrefixUnaryExpression, PostfixUnaryExpression,
  YieldExpression, ArrowFunction, FunctionExpression, AsExpression, SatisfiesExpression,
  ConditionalExpression, PropertyAccessExpression, ElementAccessExpression, CallExpression, NewExpression,
  MetaProperty, NonNullExpression, SpreadElement, TemplateExpression, TemplateSpan,
  TaggedTemplateExpression, ParenthesizedExpression, ArrayLiteralExpression, ObjectLiteralExpression, SpreadAssignment,
  PropertyAssignment, ShorthandPropertyAssignment, DeleteExpression, TypeOfExpression, VoidExpression,
  AwaitExpression, TypeAssertion, ExpressionWithTypeArguments, TemplateHead, TemplateMiddle,
  TemplateTail, PartiallyEmittedExpression, SyntheticReferenceExpression,
  Expression, Phase, SingleExpressionSyntax, SyntaxPhaseCopy,
} from "./contract.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { holdSyntaxPayload, copyNodeList, memoSyntaxPlan, syntaxHeader, withSyntaxPayload } from "./copy-node.js";

export interface ExpressionsPlans<P extends Phase, Stop, Image> {
  readonly Identifier: (node: Identifier<P>) => SyntaxPlan<Identifier<P>, Stop, Image>;
  readonly PrivateIdentifier: (node: PrivateIdentifier<P>) => SyntaxPlan<PrivateIdentifier<P>, Stop, Image>;
  readonly QualifiedName: (node: QualifiedName<P>) => SyntaxPlan<QualifiedName<P>, Stop, Image>;
  readonly ComputedPropertyName: (node: ComputedPropertyName<P>) => SyntaxPlan<ComputedPropertyName<P>, Stop, Image>;
  readonly Decorator: (node: Decorator<P>) => SyntaxPlan<Decorator<P>, Stop, Image>;
  readonly OmittedExpression: (node: OmittedExpression<P>) => SyntaxPlan<OmittedExpression<P>, Stop, Image>;
  readonly KeywordExpression: (node: KeywordExpression<P>) => SyntaxPlan<KeywordExpression<P>, Stop, Image>;
  readonly StringLiteral: (node: StringLiteral<P>) => SyntaxPlan<StringLiteral<P>, Stop, Image>;
  readonly NumericLiteral: (node: NumericLiteral<P>) => SyntaxPlan<NumericLiteral<P>, Stop, Image>;
  readonly BigIntLiteral: (node: BigIntLiteral<P>) => SyntaxPlan<BigIntLiteral<P>, Stop, Image>;
  readonly RegularExpressionLiteral: (node: RegularExpressionLiteral<P>) => SyntaxPlan<RegularExpressionLiteral<P>, Stop, Image>;
  readonly NoSubstitutionTemplateLiteral: (node: NoSubstitutionTemplateLiteral<P>) => SyntaxPlan<NoSubstitutionTemplateLiteral<P>, Stop, Image>;
  readonly BinaryExpression: (node: BinaryExpression<P>) => SyntaxPlan<BinaryExpression<P>, Stop, Image>;
  readonly PrefixUnaryExpression: (node: PrefixUnaryExpression<P>) => SyntaxPlan<PrefixUnaryExpression<P>, Stop, Image>;
  readonly PostfixUnaryExpression: (node: PostfixUnaryExpression<P>) => SyntaxPlan<PostfixUnaryExpression<P>, Stop, Image>;
  readonly YieldExpression: (node: YieldExpression<P>) => SyntaxPlan<YieldExpression<P>, Stop, Image>;
  readonly ArrowFunction: (node: ArrowFunction<P>) => SyntaxPlan<ArrowFunction<P>, Stop, Image>;
  readonly FunctionExpression: (node: FunctionExpression<P>) => SyntaxPlan<FunctionExpression<P>, Stop, Image>;
  readonly AsExpression: (node: AsExpression<P>) => SyntaxPlan<AsExpression<P>, Stop, Image>;
  readonly SatisfiesExpression: (node: SatisfiesExpression<P>) => SyntaxPlan<SatisfiesExpression<P>, Stop, Image>;
  readonly ConditionalExpression: (node: ConditionalExpression<P>) => SyntaxPlan<ConditionalExpression<P>, Stop, Image>;
  readonly PropertyAccessExpression: (node: PropertyAccessExpression<P>) => SyntaxPlan<PropertyAccessExpression<P>, Stop, Image>;
  readonly ElementAccessExpression: (node: ElementAccessExpression<P>) => SyntaxPlan<ElementAccessExpression<P>, Stop, Image>;
  readonly CallExpression: (node: CallExpression<P>) => SyntaxPlan<CallExpression<P>, Stop, Image>;
  readonly NewExpression: (node: NewExpression<P>) => SyntaxPlan<NewExpression<P>, Stop, Image>;
  readonly MetaProperty: (node: MetaProperty<P>) => SyntaxPlan<MetaProperty<P>, Stop, Image>;
  readonly NonNullExpression: (node: NonNullExpression<P>) => SyntaxPlan<NonNullExpression<P>, Stop, Image>;
  readonly SpreadElement: (node: SpreadElement<P>) => SyntaxPlan<SpreadElement<P>, Stop, Image>;
  readonly TemplateExpression: (node: TemplateExpression<P>) => SyntaxPlan<TemplateExpression<P>, Stop, Image>;
  readonly TemplateSpan: (node: TemplateSpan<P>) => SyntaxPlan<TemplateSpan<P>, Stop, Image>;
  readonly TaggedTemplateExpression: (node: TaggedTemplateExpression<P>) => SyntaxPlan<TaggedTemplateExpression<P>, Stop, Image>;
  readonly ParenthesizedExpression: (node: ParenthesizedExpression<P>) => SyntaxPlan<ParenthesizedExpression<P>, Stop, Image>;
  readonly ArrayLiteralExpression: (node: ArrayLiteralExpression<P>) => SyntaxPlan<ArrayLiteralExpression<P>, Stop, Image>;
  readonly ObjectLiteralExpression: (node: ObjectLiteralExpression<P>) => SyntaxPlan<ObjectLiteralExpression<P>, Stop, Image>;
  readonly SpreadAssignment: (node: SpreadAssignment<P>) => SyntaxPlan<SpreadAssignment<P>, Stop, Image>;
  readonly PropertyAssignment: (node: PropertyAssignment<P>) => SyntaxPlan<PropertyAssignment<P>, Stop, Image>;
  readonly ShorthandPropertyAssignment: (node: ShorthandPropertyAssignment<P>) => SyntaxPlan<ShorthandPropertyAssignment<P>, Stop, Image>;
  readonly DeleteExpression: (node: DeleteExpression<P>) => SyntaxPlan<DeleteExpression<P>, Stop, Image>;
  readonly TypeOfExpression: (node: TypeOfExpression<P>) => SyntaxPlan<TypeOfExpression<P>, Stop, Image>;
  readonly VoidExpression: (node: VoidExpression<P>) => SyntaxPlan<VoidExpression<P>, Stop, Image>;
  readonly AwaitExpression: (node: AwaitExpression<P>) => SyntaxPlan<AwaitExpression<P>, Stop, Image>;
  readonly TypeAssertion: (node: TypeAssertion<P>) => SyntaxPlan<TypeAssertion<P>, Stop, Image>;
  readonly ExpressionWithTypeArguments: (node: ExpressionWithTypeArguments<P>) => SyntaxPlan<ExpressionWithTypeArguments<P>, Stop, Image>;
  readonly TemplateHead: (node: TemplateHead<P>) => SyntaxPlan<TemplateHead<P>, Stop, Image>;
  readonly TemplateMiddle: (node: TemplateMiddle<P>) => SyntaxPlan<TemplateMiddle<P>, Stop, Image>;
  readonly TemplateTail: (node: TemplateTail<P>) => SyntaxPlan<TemplateTail<P>, Stop, Image>;
  readonly PartiallyEmittedExpression: (node: PartiallyEmittedExpression<P>) => SyntaxPlan<PartiallyEmittedExpression<P>, Stop, Image>;
  readonly SyntheticReferenceExpression: (node: SyntheticReferenceExpression<P>) => SyntaxPlan<SyntheticReferenceExpression<P>, Stop, Image>;
  readonly LiteralKeywordExpression: (node: KeywordExpression<P, "TrueKeyword" | "FalseKeyword" | "NullKeyword">) => SyntaxPlan<KeywordExpression<P, "TrueKeyword" | "FalseKeyword" | "NullKeyword">, Stop, Image>;
}

export function createExpressionsPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>,
  ports: () => SyntaxCopyPorts<P, Stop, Image>, binaryOf: (node: BinaryExpression<P>) => BinarySyntaxReceipt<P>,
  expressionOf: (node: SingleExpressionSyntax<P>) => Expression<P>): ExpressionsPlans<P, Stop, Image> {
  const Identifier = new Map<Identifier<P>, SyntaxPlan<Identifier<P>, Stop, Image>>();
  const PrivateIdentifier = new Map<PrivateIdentifier<P>, SyntaxPlan<PrivateIdentifier<P>, Stop, Image>>();
  const QualifiedName = new Map<QualifiedName<P>, SyntaxPlan<QualifiedName<P>, Stop, Image>>();
  const ComputedPropertyName = new Map<ComputedPropertyName<P>, SyntaxPlan<ComputedPropertyName<P>, Stop, Image>>();
  const Decorator = new Map<Decorator<P>, SyntaxPlan<Decorator<P>, Stop, Image>>();
  const OmittedExpression = new Map<OmittedExpression<P>, SyntaxPlan<OmittedExpression<P>, Stop, Image>>();
  const StringLiteral = new Map<StringLiteral<P>, SyntaxPlan<StringLiteral<P>, Stop, Image>>();
  const NumericLiteral = new Map<NumericLiteral<P>, SyntaxPlan<NumericLiteral<P>, Stop, Image>>();
  const BigIntLiteral = new Map<BigIntLiteral<P>, SyntaxPlan<BigIntLiteral<P>, Stop, Image>>();
  const RegularExpressionLiteral = new Map<RegularExpressionLiteral<P>, SyntaxPlan<RegularExpressionLiteral<P>, Stop, Image>>();
  const NoSubstitutionTemplateLiteral = new Map<NoSubstitutionTemplateLiteral<P>, SyntaxPlan<NoSubstitutionTemplateLiteral<P>, Stop, Image>>();
  const BinaryExpression = new Map<BinaryExpression<P>, SyntaxPlan<BinaryExpression<P>, Stop, Image>>();
  const PrefixUnaryExpression = new Map<PrefixUnaryExpression<P>, SyntaxPlan<PrefixUnaryExpression<P>, Stop, Image>>();
  const PostfixUnaryExpression = new Map<PostfixUnaryExpression<P>, SyntaxPlan<PostfixUnaryExpression<P>, Stop, Image>>();
  const YieldExpression = new Map<YieldExpression<P>, SyntaxPlan<YieldExpression<P>, Stop, Image>>();
  const ArrowFunction = new Map<ArrowFunction<P>, SyntaxPlan<ArrowFunction<P>, Stop, Image>>();
  const FunctionExpression = new Map<FunctionExpression<P>, SyntaxPlan<FunctionExpression<P>, Stop, Image>>();
  const AsExpression = new Map<AsExpression<P>, SyntaxPlan<AsExpression<P>, Stop, Image>>();
  const SatisfiesExpression = new Map<SatisfiesExpression<P>, SyntaxPlan<SatisfiesExpression<P>, Stop, Image>>();
  const ConditionalExpression = new Map<ConditionalExpression<P>, SyntaxPlan<ConditionalExpression<P>, Stop, Image>>();
  const PropertyAccessExpression = new Map<PropertyAccessExpression<P>, SyntaxPlan<PropertyAccessExpression<P>, Stop, Image>>();
  const ElementAccessExpression = new Map<ElementAccessExpression<P>, SyntaxPlan<ElementAccessExpression<P>, Stop, Image>>();
  const CallExpression = new Map<CallExpression<P>, SyntaxPlan<CallExpression<P>, Stop, Image>>();
  const NewExpression = new Map<NewExpression<P>, SyntaxPlan<NewExpression<P>, Stop, Image>>();
  const MetaProperty = new Map<MetaProperty<P>, SyntaxPlan<MetaProperty<P>, Stop, Image>>();
  const NonNullExpression = new Map<NonNullExpression<P>, SyntaxPlan<NonNullExpression<P>, Stop, Image>>();
  const SpreadElement = new Map<SpreadElement<P>, SyntaxPlan<SpreadElement<P>, Stop, Image>>();
  const TemplateExpression = new Map<TemplateExpression<P>, SyntaxPlan<TemplateExpression<P>, Stop, Image>>();
  const TemplateSpan = new Map<TemplateSpan<P>, SyntaxPlan<TemplateSpan<P>, Stop, Image>>();
  const TaggedTemplateExpression = new Map<TaggedTemplateExpression<P>, SyntaxPlan<TaggedTemplateExpression<P>, Stop, Image>>();
  const ParenthesizedExpression = new Map<ParenthesizedExpression<P>, SyntaxPlan<ParenthesizedExpression<P>, Stop, Image>>();
  const ArrayLiteralExpression = new Map<ArrayLiteralExpression<P>, SyntaxPlan<ArrayLiteralExpression<P>, Stop, Image>>();
  const ObjectLiteralExpression = new Map<ObjectLiteralExpression<P>, SyntaxPlan<ObjectLiteralExpression<P>, Stop, Image>>();
  const SpreadAssignment = new Map<SpreadAssignment<P>, SyntaxPlan<SpreadAssignment<P>, Stop, Image>>();
  const PropertyAssignment = new Map<PropertyAssignment<P>, SyntaxPlan<PropertyAssignment<P>, Stop, Image>>();
  const ShorthandPropertyAssignment = new Map<ShorthandPropertyAssignment<P>, SyntaxPlan<ShorthandPropertyAssignment<P>, Stop, Image>>();
  const DeleteExpression = new Map<DeleteExpression<P>, SyntaxPlan<DeleteExpression<P>, Stop, Image>>();
  const TypeOfExpression = new Map<TypeOfExpression<P>, SyntaxPlan<TypeOfExpression<P>, Stop, Image>>();
  const VoidExpression = new Map<VoidExpression<P>, SyntaxPlan<VoidExpression<P>, Stop, Image>>();
  const AwaitExpression = new Map<AwaitExpression<P>, SyntaxPlan<AwaitExpression<P>, Stop, Image>>();
  const TypeAssertion = new Map<TypeAssertion<P>, SyntaxPlan<TypeAssertion<P>, Stop, Image>>();
  const ExpressionWithTypeArguments = new Map<ExpressionWithTypeArguments<P>, SyntaxPlan<ExpressionWithTypeArguments<P>, Stop, Image>>();
  const TemplateHead = new Map<TemplateHead<P>, SyntaxPlan<TemplateHead<P>, Stop, Image>>();
  const TemplateMiddle = new Map<TemplateMiddle<P>, SyntaxPlan<TemplateMiddle<P>, Stop, Image>>();
  const TemplateTail = new Map<TemplateTail<P>, SyntaxPlan<TemplateTail<P>, Stop, Image>>();
  const PartiallyEmittedExpression = new Map<PartiallyEmittedExpression<P>, SyntaxPlan<PartiallyEmittedExpression<P>, Stop, Image>>();
  const SyntheticReferenceExpression = new Map<SyntheticReferenceExpression<P>, SyntaxPlan<SyntheticReferenceExpression<P>, Stop, Image>>();
  const NullKeyword = new Map<KeywordExpression<P>, SyntaxPlan<KeywordExpression<P, "NullKeyword">, Stop, Image>>();
  const TrueKeyword = new Map<KeywordExpression<P>, SyntaxPlan<KeywordExpression<P, "TrueKeyword">, Stop, Image>>();
  const FalseKeyword = new Map<KeywordExpression<P>, SyntaxPlan<KeywordExpression<P, "FalseKeyword">, Stop, Image>>();
  const ThisKeyword = new Map<KeywordExpression<P>, SyntaxPlan<KeywordExpression<P, "ThisKeyword">, Stop, Image>>();
  const SuperKeyword = new Map<KeywordExpression<P>, SyntaxPlan<KeywordExpression<P, "SuperKeyword">, Stop, Image>>();
  const ImportKeyword = new Map<KeywordExpression<P>, SyntaxPlan<KeywordExpression<P, "ImportKeyword">, Stop, Image>>();
  const literalKeyword = (node: KeywordExpression<P>, kind: "TrueKeyword" | "FalseKeyword" | "NullKeyword"): SyntaxPlan<KeywordExpression<P, "TrueKeyword" | "FalseKeyword" | "NullKeyword">, Stop, Image> => {
    switch (kind) {
      case "TrueKeyword": return memoSyntaxPlan(TrueKeyword, node, () => withSyntaxPayload(phase.KeywordExpression, node.tsonic, () => {
        const header = syntaxHeader(node);
        return tsonic => ({ ...header, kind: "TrueKeyword", tsonic });
      }));
      case "FalseKeyword": return memoSyntaxPlan(FalseKeyword, node, () => withSyntaxPayload(phase.KeywordExpression, node.tsonic, () => {
        const header = syntaxHeader(node);
        return tsonic => ({ ...header, kind: "FalseKeyword", tsonic });
      }));
      case "NullKeyword": return memoSyntaxPlan(NullKeyword, node, () => withSyntaxPayload(phase.KeywordExpression, node.tsonic, () => {
        const header = syntaxHeader(node);
        return tsonic => ({ ...header, kind: "NullKeyword", tsonic });
      }));
    }
  };
  return {
    Identifier: node => memoSyntaxPlan(Identifier, node, () => withSyntaxPayload(phase.Identifier, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tsonic,
      });
    })),
    PrivateIdentifier: node => memoSyntaxPlan(PrivateIdentifier, node, () => withSyntaxPayload(phase.PrivateIdentifier, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tsonic,
      });
    })),
    QualifiedName: node => memoSyntaxPlan(QualifiedName, node, () => withSyntaxPayload(phase.QualifiedName, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        left: ports().EntityName(node.left).read(),
        right: ports().Identifier(node.right).read(),
        tsonic,
      });
    })),
    ComputedPropertyName: node => memoSyntaxPlan(ComputedPropertyName, node, () => withSyntaxPayload(phase.ComputedPropertyName, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    Decorator: node => memoSyntaxPlan(Decorator, node, () => withSyntaxPayload(phase.Decorator, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().LeftHandSideExpression(node.expression).read(),
        tsonic,
      });
    })),
    OmittedExpression: node => memoSyntaxPlan(OmittedExpression, node, () => withSyntaxPayload(phase.OmittedExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    KeywordExpression: node => {
      switch (node.kind) {
        case "NullKeyword":
        case "TrueKeyword":
        case "FalseKeyword": return literalKeyword(node, node.kind);
        case "ThisKeyword": return memoSyntaxPlan(ThisKeyword, node, () => withSyntaxPayload(phase.KeywordExpression, node.tsonic, () => {
          const header = syntaxHeader(node);
          return tsonic => ({ ...header, kind: "ThisKeyword", tsonic });
        }));
        case "SuperKeyword": return memoSyntaxPlan(SuperKeyword, node, () => withSyntaxPayload(phase.KeywordExpression, node.tsonic, () => {
          const header = syntaxHeader(node);
          return tsonic => ({ ...header, kind: "SuperKeyword", tsonic });
        }));
        case "ImportKeyword": return memoSyntaxPlan(ImportKeyword, node, () => withSyntaxPayload(phase.KeywordExpression, node.tsonic, () => {
          const header = syntaxHeader(node);
          return tsonic => ({ ...header, kind: "ImportKeyword", tsonic });
        }));
      }
    },
    StringLiteral: node => memoSyntaxPlan(StringLiteral, node, () => withSyntaxPayload(phase.StringLiteral, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        tsonic,
      });
    })),
    NumericLiteral: node => memoSyntaxPlan(NumericLiteral, node, () => withSyntaxPayload(phase.NumericLiteral, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        tsonic,
      });
    })),
    BigIntLiteral: node => memoSyntaxPlan(BigIntLiteral, node, () => withSyntaxPayload(phase.BigIntLiteral, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        tsonic,
      });
    })),
    RegularExpressionLiteral: node => memoSyntaxPlan(RegularExpressionLiteral, node, () => withSyntaxPayload(phase.RegularExpressionLiteral, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        tsonic,
      });
    })),
    NoSubstitutionTemplateLiteral: node => memoSyntaxPlan(NoSubstitutionTemplateLiteral, node, () => withSyntaxPayload(phase.NoSubstitutionTemplateLiteral, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags, rawText, templateFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        rawText,
        templateFlags,
        tsonic,
      });
    })),
    BinaryExpression: node => memoSyntaxPlan(BinaryExpression, node, () => withSyntaxPayload(phase.BinaryExpression, node.tsonic, () => tsonic => {
      const shape = binaryOf(node);
      const modifiers = shape.modifiers(item => ports().ModifierLike(item).read());
      const left = ports().Expression(shape.left()).read();
      const rawType = shape.type();
      return { ...shape.header, kind: "BinaryExpression", modifiers, left,
        type: rawType === null ? null : ports().TypeNode(rawType).read(),
        operatorToken: shape.operator(), right: ports().Expression(shape.right()).read(), tsonic };
    })),
    PrefixUnaryExpression: node => memoSyntaxPlan(PrefixUnaryExpression, node, () => withSyntaxPayload(phase.PrefixUnaryExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, operator } = node;
      return tsonic => ({
        ...header,
        kind,
        operator,
        operand: ports().Expression(node.operand).read(),
        tsonic,
      });
    })),
    PostfixUnaryExpression: node => memoSyntaxPlan(PostfixUnaryExpression, node, () => withSyntaxPayload(phase.PostfixUnaryExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, operator } = node;
      return tsonic => ({
        ...header,
        kind,
        operand: ports().Expression(node.operand).read(),
        operator,
        tsonic,
      });
    })),
    YieldExpression: node => memoSyntaxPlan(YieldExpression, node, () => withSyntaxPayload(phase.YieldExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, asteriskToken } = node;
      return tsonic => ({
        ...header,
        kind,
        asteriskToken,
        expression: node.expression === null ? null : ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    ArrowFunction: node => memoSyntaxPlan(ArrowFunction, node, () => withSyntaxPayload(phase.ArrowFunction, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, asteriskToken, equalsGreaterThanToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        asteriskToken,
        body: node.body === null ? null : ports().BlockOrExpression(node.body).read(),
        equalsGreaterThanToken,
        tsonic,
      });
    })),
    FunctionExpression: node => memoSyntaxPlan(FunctionExpression, node, () => withSyntaxPayload(phase.FunctionExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, asteriskToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        asteriskToken,
        body: node.body === null ? null : ports().BlockOrExpression(node.body).read(),
        name: node.name === null ? null : ports().Identifier(node.name).read(),
        tsonic,
      });
    })),
    AsExpression: node => memoSyntaxPlan(AsExpression, node, () => withSyntaxPayload(phase.AsExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    SatisfiesExpression: node => memoSyntaxPlan(SatisfiesExpression, node, () => withSyntaxPayload(phase.SatisfiesExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    ConditionalExpression: node => memoSyntaxPlan(ConditionalExpression, node, () => withSyntaxPayload(phase.ConditionalExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, questionToken, colonToken } = node;
      return tsonic => ({
        ...header,
        kind,
        condition: ports().Expression(node.condition).read(),
        questionToken,
        whenTrue: ports().Expression(node.whenTrue).read(),
        colonToken,
        whenFalse: ports().Expression(node.whenFalse).read(),
        tsonic,
      });
    })),
    PropertyAccessExpression: node => memoSyntaxPlan(PropertyAccessExpression, node, () => withSyntaxPayload(phase.PropertyAccessExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, questionDotToken } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        questionDotToken,
        name: ports().MemberName(node.name).read(),
        tsonic,
      });
    })),
    ElementAccessExpression: node => memoSyntaxPlan(ElementAccessExpression, node, () => withSyntaxPayload(phase.ElementAccessExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, questionDotToken } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        questionDotToken,
        argumentExpression: ports().Expression(node.argumentExpression).read(),
        tsonic,
      });
    })),
    CallExpression: node => memoSyntaxPlan(CallExpression, node, () => withSyntaxPayload(phase.CallExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, questionDotToken } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        questionDotToken,
        typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
        arguments: copyNodeList(node.arguments, item => ports().Expression(item).read()),
        tsonic,
      });
    })),
    NewExpression: node => memoSyntaxPlan(NewExpression, node, () => withSyntaxPayload(phase.NewExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
        arguments: node.arguments === null ? null : copyNodeList(node.arguments, item => ports().Expression(item).read()),
        tsonic,
      });
    })),
    MetaProperty: node => memoSyntaxPlan(MetaProperty, node, () => withSyntaxPayload(phase.MetaProperty, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, keywordToken } = node;
      return tsonic => ({
        ...header,
        kind,
        keywordToken,
        name: ports().Identifier(node.name).read(),
        tsonic,
      });
    })),
    NonNullExpression: node => memoSyntaxPlan(NonNullExpression, node, () => withSyntaxPayload(phase.NonNullExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    SpreadElement: node => memoSyntaxPlan(SpreadElement, node, () => withSyntaxPayload(phase.SpreadElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    TemplateExpression: node => memoSyntaxPlan(TemplateExpression, node, () => withSyntaxPayload(phase.TemplateExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        head: ports().TemplateHead(node.head).read(),
        templateSpans: copyNodeList(node.templateSpans, item => ports().TemplateSpan(item).read()),
        tsonic,
      });
    })),
    TemplateSpan: node => memoSyntaxPlan(TemplateSpan, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        literal: ports().TemplateMiddleOrTail(node.literal).read(),
        tsonic,
      });
    })),
    TaggedTemplateExpression: node => memoSyntaxPlan(TaggedTemplateExpression, node, () => withSyntaxPayload(phase.TaggedTemplateExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, questionDotToken } = node;
      return tsonic => ({
        ...header,
        kind,
        tag: ports().Expression(node.tag).read(),
        questionDotToken,
        typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
        template: ports().TemplateLiteral(node.template).read(),
        tsonic,
      });
    })),
    ParenthesizedExpression: node => memoSyntaxPlan(ParenthesizedExpression, node, () => withSyntaxPayload(phase.ParenthesizedExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    ArrayLiteralExpression: node => memoSyntaxPlan(ArrayLiteralExpression, node, () => withSyntaxPayload(phase.ArrayLiteralExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, multiLine } = node;
      return tsonic => ({
        ...header,
        kind,
        elements: copyNodeList(node.elements, item => ports().Expression(item).read()),
        multiLine,
        tsonic,
      });
    })),
    ObjectLiteralExpression: node => memoSyntaxPlan(ObjectLiteralExpression, node, () => withSyntaxPayload(phase.ObjectLiteralExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, multiLine } = node;
      return tsonic => ({
        ...header,
        kind,
        properties: copyNodeList(node.properties, item => ports().ObjectLiteralElementLike(item).read()),
        multiLine,
        tsonic,
      });
    })),
    SpreadAssignment: node => memoSyntaxPlan(SpreadAssignment, node, () => withSyntaxPayload(phase.SpreadAssignment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    PropertyAssignment: node => memoSyntaxPlan(PropertyAssignment, node, () => withSyntaxPayload(phase.PropertyAssignment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        initializer: ports().Expression(node.initializer).read(),
        tsonic,
      });
    })),
    ShorthandPropertyAssignment: node => memoSyntaxPlan(ShorthandPropertyAssignment, node, () => withSyntaxPayload(phase.ShorthandPropertyAssignment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken, equalsToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        equalsToken,
        objectAssignmentInitializer: node.objectAssignmentInitializer === null ? null : ports().Expression(node.objectAssignmentInitializer).read(),
        tsonic,
      });
    })),
    DeleteExpression: node => memoSyntaxPlan(DeleteExpression, node, () => withSyntaxPayload(phase.DeleteExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    TypeOfExpression: node => memoSyntaxPlan(TypeOfExpression, node, () => withSyntaxPayload(phase.TypeOfExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    VoidExpression: node => memoSyntaxPlan(VoidExpression, node, () => withSyntaxPayload(phase.VoidExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    AwaitExpression: node => memoSyntaxPlan(AwaitExpression, node, () => withSyntaxPayload(phase.AwaitExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    TypeAssertion: node => memoSyntaxPlan(TypeAssertion, node, () => withSyntaxPayload(phase.TypeAssertion, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type).read(),
        expression: ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    ExpressionWithTypeArguments: node => memoSyntaxPlan(ExpressionWithTypeArguments, node, () => withSyntaxPayload(phase.ExpressionWithTypeArguments, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
        tsonic,
      });
    })),
    TemplateHead: node => memoSyntaxPlan(TemplateHead, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags, rawText, templateFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        rawText,
        templateFlags,
        tsonic,
      });
    })),
    TemplateMiddle: node => memoSyntaxPlan(TemplateMiddle, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags, rawText, templateFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        rawText,
        templateFlags,
        tsonic,
      });
    })),
    TemplateTail: node => memoSyntaxPlan(TemplateTail, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags, rawText, templateFlags } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        rawText,
        templateFlags,
        tsonic,
      });
    })),
    PartiallyEmittedExpression: node => memoSyntaxPlan(PartiallyEmittedExpression, node, () => withSyntaxPayload(phase.PartiallyEmittedExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    SyntheticReferenceExpression: node => memoSyntaxPlan(SyntheticReferenceExpression, node, () => withSyntaxPayload(phase.SyntheticReferenceExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        thisArg: ports().Expression(node.thisArg).read(),
        tsonic,
      });
    })),
    LiteralKeywordExpression: node => literalKeyword(node, node.kind),
  };
}

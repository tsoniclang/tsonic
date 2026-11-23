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
  AnnotatedExpressionSyntax, AnnotatedExpressionSyntaxReceipt, ApplicationSyntaxReceipt, ArraySyntaxReceipt, CallOrNewExpression,
  ConditionalSyntaxReceipt, ElementSyntaxReceipt, Expression, FunctionSyntaxReceipt, ObjectSyntaxReceipt, Phase, PropertySyntaxReceipt,
  ExpressionStructureSyntax, SingleExpressionSyntax, SyntaxPhaseCopy, SyntaxStructureReceipt, UnarySyntax, UnarySyntaxReceipt,
} from "./contract.js";
import { throwInvariant } from "../diag/index.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { finishSignatureSyntax, holdSyntaxPayload, finishFunctionSyntax, memoSyntaxPlan, requireSyntaxStructure, syntaxHeader, withSyntaxPayload } from "./copy-node.js";

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
  expressionOf: (node: SingleExpressionSyntax<P>) => Expression<P>,
  applicationOf: (node: CallOrNewExpression<P>) => ApplicationSyntaxReceipt<P>,
  functionOf: (node: FunctionExpression<P>) => FunctionSyntaxReceipt<P>,
  unaryOf: (node: UnarySyntax<P>) => UnarySyntaxReceipt<P>,
  annotatedOf: (node: AnnotatedExpressionSyntax<P>) => AnnotatedExpressionSyntaxReceipt<P>,
  conditionalOf: (node: ConditionalExpression<P>) => ConditionalSyntaxReceipt<P>,
  propertyOf: (node: PropertyAccessExpression<P>) => PropertySyntaxReceipt<P>,
  elementOf: (node: ElementAccessExpression<P>) => ElementSyntaxReceipt<P>,
  arrayOf: (node: ArrayLiteralExpression<P>) => ArraySyntaxReceipt<P>,
  objectOf: (node: ObjectLiteralExpression<P>) => ObjectSyntaxReceipt<P>,
  structureOf: (node: ExpressionStructureSyntax<P>) => SyntaxStructureReceipt<P>): ExpressionsPlans<P, Stop, Image> {
  function structure<Kind extends SyntaxStructureReceipt<P>["kind"]>(node: ExpressionStructureSyntax<P>, kind: Kind) {
    return requireSyntaxStructure<P, Kind>(structureOf(node), kind);
  }
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
      return tsonic => {
        const fields = structure(node, "qualified-name");
        return { ...header, kind, left: ports().EntityName(fields.left()), right: ports().Identifier(fields.right()).read(), tsonic };
      };
    })),
    ComputedPropertyName: node => memoSyntaxPlan(ComputedPropertyName, node, () => withSyntaxPayload(phase.ComputedPropertyName, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    Decorator: node => memoSyntaxPlan(Decorator, node, () => withSyntaxPayload(phase.Decorator, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().LeftHandSideExpression(structure(node, "decorator").expression()),
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
      const modifiers = shape.modifiers(item => ports().ModifierLike(item));
      const left = ports().Expression(shape.left());
      const rawType = shape.type();
      return { ...shape.header, kind: "BinaryExpression", modifiers, left,
        type: rawType === null ? null : ports().TypeNode(rawType),
        operatorToken: shape.operator(), right: ports().Expression(shape.right()), tsonic };
    })),
    PrefixUnaryExpression: node => memoSyntaxPlan(PrefixUnaryExpression, node, () => withSyntaxPayload(phase.PrefixUnaryExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, operator } = node;
      return tsonic => ({
        ...header,
        kind,
        operator,
        operand: ports().Expression(unaryOf(node).operand()),
        tsonic,
      });
    })),
    PostfixUnaryExpression: node => memoSyntaxPlan(PostfixUnaryExpression, node, () => withSyntaxPayload(phase.PostfixUnaryExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, operator } = node;
      return tsonic => ({
        ...header,
        kind,
        operand: ports().Expression(unaryOf(node).operand()),
        operator,
        tsonic,
      });
    })),
    YieldExpression: node => memoSyntaxPlan(YieldExpression, node, () => withSyntaxPayload(phase.YieldExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "yield");
        const expression = fields.expression();
        return { ...header, kind, asteriskToken: fields.asterisk(), expression: expression === null ? null : ports().Expression(expression), tsonic };
      };
    })),
    ArrowFunction: node => memoSyntaxPlan(ArrowFunction, node, () => withSyntaxPayload(phase.ArrowFunction, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "arrow");
        const body = fields.body();
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike),
          ...finishSignatureSyntax(fields, ports()),
          asteriskToken: fields.asterisk(), body: body === null ? null : ports().BlockOrExpression(body), equalsGreaterThanToken: fields.arrow(), tsonic };
      };
    })),
    FunctionExpression: node => memoSyntaxPlan(FunctionExpression, node, () => withSyntaxPayload(phase.FunctionExpression, node.tsonic, () => tsonic =>
      ({ kind: "FunctionExpression", ...finishFunctionSyntax(functionOf(node), ports()), tsonic }))),
    AsExpression: node => memoSyntaxPlan(AsExpression, node, () => withSyntaxPayload(phase.AsExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      return tsonic => {
        const shape = annotatedOf(node);
        return { ...header, kind: "AsExpression", expression: ports().Expression(shape.expression()),
          type: ports().TypeNode(shape.type()), tsonic };
      };
    })),
    SatisfiesExpression: node => memoSyntaxPlan(SatisfiesExpression, node, () => withSyntaxPayload(phase.SatisfiesExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      return tsonic => {
        const shape = annotatedOf(node);
        return { ...header, kind: "SatisfiesExpression", expression: ports().Expression(shape.expression()),
          type: ports().TypeNode(shape.type()), tsonic };
      };
    })),
    ConditionalExpression: node => memoSyntaxPlan(ConditionalExpression, node, () => withSyntaxPayload(phase.ConditionalExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      return tsonic => {
        const shape = conditionalOf(node);
        return { ...header, kind: "ConditionalExpression", condition: ports().Expression(shape.condition()),
          questionToken: shape.question(), whenTrue: ports().Expression(shape.whenTrue()), colonToken: shape.colon(),
          whenFalse: ports().Expression(shape.whenFalse()), tsonic };
      };
    })),
    PropertyAccessExpression: node => memoSyntaxPlan(PropertyAccessExpression, node, () => withSyntaxPayload(phase.PropertyAccessExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      return tsonic => {
        const shape = propertyOf(node);
        return { ...header, kind: "PropertyAccessExpression", expression: ports().Expression(shape.expression()),
          questionDotToken: shape.questionDotToken(), name: ports().MemberName(shape.name()), tsonic };
      };
    })),
    ElementAccessExpression: node => memoSyntaxPlan(ElementAccessExpression, node, () => withSyntaxPayload(phase.ElementAccessExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      return tsonic => {
        const shape = elementOf(node);
        return { ...header, kind: "ElementAccessExpression", expression: ports().Expression(shape.expression()),
          questionDotToken: shape.questionDotToken(), argumentExpression: ports().Expression(shape.argument()), tsonic };
      };
    })),
    CallExpression: node => memoSyntaxPlan(CallExpression, node, () => withSyntaxPayload(phase.CallExpression, node.tsonic, () => tsonic => {
      const shape = applicationOf(node);
      const expression = ports().Expression(shape.expression());
      const typeArguments = shape.typeArguments(item => ports().TypeNode(item));
      const args = shape.arguments(item => ports().Expression(item));
      if (args === null) return throwInvariant({
        owner: "ir-hir", query: null, origin: shape.header.origin, message: "A call requires its admitted argument list.",
      });
      return { ...shape.header, kind: "CallExpression", expression, questionDotToken: shape.questionDotToken(), typeArguments, arguments: args, tsonic };
    })),
    NewExpression: node => memoSyntaxPlan(NewExpression, node, () => withSyntaxPayload(phase.NewExpression, node.tsonic, () => tsonic => {
      const shape = applicationOf(node);
      return { ...shape.header, kind: "NewExpression", expression: ports().Expression(shape.expression()),
        typeArguments: shape.typeArguments(item => ports().TypeNode(item)),
        arguments: shape.arguments(item => ports().Expression(item)), tsonic };
    })),
    MetaProperty: node => memoSyntaxPlan(MetaProperty, node, () => withSyntaxPayload(phase.MetaProperty, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, keywordToken } = node;
      return tsonic => ({
        ...header,
        kind,
        keywordToken,
        name: ports().Identifier(structure(node, "meta-property").name()).read(),
        tsonic,
      });
    })),
    NonNullExpression: node => memoSyntaxPlan(NonNullExpression, node, () => withSyntaxPayload(phase.NonNullExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    SpreadElement: node => memoSyntaxPlan(SpreadElement, node, () => withSyntaxPayload(phase.SpreadElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    TemplateExpression: node => memoSyntaxPlan(TemplateExpression, node, () => withSyntaxPayload(phase.TemplateExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "template-expression");
        return { ...header, kind, head: ports().TemplateHead(fields.head()).read(),
          templateSpans: fields.spans(item => ports().TemplateSpan(item).read()), tsonic };
      };
    })),
    TemplateSpan: node => memoSyntaxPlan(TemplateSpan, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "template-span");
        return { ...header, kind, expression: ports().Expression(fields.expression()), literal: ports().TemplateMiddleOrTail(fields.literal()), tsonic };
      };
    })),
    TaggedTemplateExpression: node => memoSyntaxPlan(TaggedTemplateExpression, node, () => withSyntaxPayload(phase.TaggedTemplateExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "tagged-template");
        return { ...header, kind, tag: ports().Expression(fields.tag()), questionDotToken: fields.question(), typeArguments: fields.args(ports().TypeNode),
          template: ports().TemplateLiteral(fields.template()), tsonic };
      };
    })),
    ParenthesizedExpression: node => memoSyntaxPlan(ParenthesizedExpression, node, () => withSyntaxPayload(phase.ParenthesizedExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    ArrayLiteralExpression: node => memoSyntaxPlan(ArrayLiteralExpression, node, () => withSyntaxPayload(phase.ArrayLiteralExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, multiLine } = node;
      return tsonic => ({
        ...header,
        kind,
        elements: arrayOf(node).elements(item => ports().Expression(item)),
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
        properties: objectOf(node).properties(item => ports().ObjectLiteralElementLike(item)),
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
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    PropertyAssignment: node => memoSyntaxPlan(PropertyAssignment, node, () => withSyntaxPayload(phase.PropertyAssignment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "property-assignment");
        const type = fields.type();
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike), name: ports().PropertyName(fields.name()), postfixToken: fields.postfix(),
          type: type === null ? null : ports().TypeNode(type), initializer: ports().Expression(fields.initializer()), tsonic };
      };
    })),
    ShorthandPropertyAssignment: node => memoSyntaxPlan(ShorthandPropertyAssignment, node, () => withSyntaxPayload(phase.ShorthandPropertyAssignment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "shorthand-assignment");
        const type = fields.type();
        const initializer = fields.initializer();
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike), name: ports().PropertyName(fields.name()), postfixToken: fields.postfix(),
          type: type === null ? null : ports().TypeNode(type), equalsToken: fields.equals(),
          objectAssignmentInitializer: initializer === null ? null : ports().Expression(initializer), tsonic };
      };
    })),
    DeleteExpression: node => memoSyntaxPlan(DeleteExpression, node, () => withSyntaxPayload(phase.DeleteExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    TypeOfExpression: node => memoSyntaxPlan(TypeOfExpression, node, () => withSyntaxPayload(phase.TypeOfExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    VoidExpression: node => memoSyntaxPlan(VoidExpression, node, () => withSyntaxPayload(phase.VoidExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    AwaitExpression: node => memoSyntaxPlan(AwaitExpression, node, () => withSyntaxPayload(phase.AwaitExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    TypeAssertion: node => memoSyntaxPlan(TypeAssertion, node, () => withSyntaxPayload(phase.TypeAssertion, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "type-assertion");
        return { ...header, kind, type: ports().TypeNode(fields.type()), expression: ports().Expression(fields.expression()), tsonic };
      };
    })),
    ExpressionWithTypeArguments: node => memoSyntaxPlan(ExpressionWithTypeArguments, node, () => withSyntaxPayload(phase.ExpressionWithTypeArguments, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "expression-type-arguments");
        return { ...header, kind, expression: ports().Expression(fields.expression()), typeArguments: fields.args(ports().TypeNode), tsonic };
      };
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
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    SyntheticReferenceExpression: node => memoSyntaxPlan(SyntheticReferenceExpression, node, () => withSyntaxPayload(phase.SyntheticReferenceExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "synthetic-reference");
        return { ...header, kind, expression: ports().Expression(fields.expression()), thisArg: ports().Expression(fields.thisArg()), tsonic };
      };
    })),
    LiteralKeywordExpression: node => literalKeyword(node, node.kind),
  };
}

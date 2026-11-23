import type {
  KeywordTypeNode, UnionTypeNode, IntersectionTypeNode, ConditionalTypeNode, TypeOperatorNode,
  InferTypeNode, ArrayTypeNode, IndexedAccessTypeNode, TypeReferenceNode, LiteralTypeNode,
  ThisTypeNode, TypePredicateNode, ImportAttribute, ImportAttributes, TypeQueryNode,
  MappedTypeNode, TypeLiteralNode, TupleTypeNode, NamedTupleMember, OptionalTypeNode,
  RestTypeNode, ParenthesizedTypeNode, FunctionTypeNode, ConstructorTypeNode, TemplateLiteralTypeNode,
  TemplateLiteralTypeSpan, TypeParameterDeclaration,
  Phase, SyntaxPhaseCopy, SyntaxStructureReceipt, TypeStructureSyntax,
} from "./contract.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { holdSyntaxPayload, copyNodeList, memoSyntaxPlan, requireSyntaxStructure, syntaxHeader, withSyntaxPayload } from "./copy-node.js";

export interface TypesPlans<P extends Phase, Stop, Image> {
  readonly KeywordTypeNode: (node: KeywordTypeNode<P>) => SyntaxPlan<KeywordTypeNode<P>, Stop, Image>;
  readonly UnionTypeNode: (node: UnionTypeNode<P>) => SyntaxPlan<UnionTypeNode<P>, Stop, Image>;
  readonly IntersectionTypeNode: (node: IntersectionTypeNode<P>) => SyntaxPlan<IntersectionTypeNode<P>, Stop, Image>;
  readonly ConditionalTypeNode: (node: ConditionalTypeNode<P>) => SyntaxPlan<ConditionalTypeNode<P>, Stop, Image>;
  readonly TypeOperatorNode: (node: TypeOperatorNode<P>) => SyntaxPlan<TypeOperatorNode<P>, Stop, Image>;
  readonly InferTypeNode: (node: InferTypeNode<P>) => SyntaxPlan<InferTypeNode<P>, Stop, Image>;
  readonly ArrayTypeNode: (node: ArrayTypeNode<P>) => SyntaxPlan<ArrayTypeNode<P>, Stop, Image>;
  readonly IndexedAccessTypeNode: (node: IndexedAccessTypeNode<P>) => SyntaxPlan<IndexedAccessTypeNode<P>, Stop, Image>;
  readonly TypeReferenceNode: (node: TypeReferenceNode<P>) => SyntaxPlan<TypeReferenceNode<P>, Stop, Image>;
  readonly LiteralTypeNode: (node: LiteralTypeNode<P>) => SyntaxPlan<LiteralTypeNode<P>, Stop, Image>;
  readonly ThisTypeNode: (node: ThisTypeNode<P>) => SyntaxPlan<ThisTypeNode<P>, Stop, Image>;
  readonly TypePredicateNode: (node: TypePredicateNode<P>) => SyntaxPlan<TypePredicateNode<P>, Stop, Image>;
  readonly ImportAttribute: (node: ImportAttribute<P>) => SyntaxPlan<ImportAttribute<P>, Stop, Image>;
  readonly ImportAttributes: (node: ImportAttributes<P>) => SyntaxPlan<ImportAttributes<P>, Stop, Image>;
  readonly TypeQueryNode: (node: TypeQueryNode<P>) => SyntaxPlan<TypeQueryNode<P>, Stop, Image>;
  readonly MappedTypeNode: (node: MappedTypeNode<P>) => SyntaxPlan<MappedTypeNode<P>, Stop, Image>;
  readonly TypeLiteralNode: (node: TypeLiteralNode<P>) => SyntaxPlan<TypeLiteralNode<P>, Stop, Image>;
  readonly TupleTypeNode: (node: TupleTypeNode<P>) => SyntaxPlan<TupleTypeNode<P>, Stop, Image>;
  readonly NamedTupleMember: (node: NamedTupleMember<P>) => SyntaxPlan<NamedTupleMember<P>, Stop, Image>;
  readonly OptionalTypeNode: (node: OptionalTypeNode<P>) => SyntaxPlan<OptionalTypeNode<P>, Stop, Image>;
  readonly RestTypeNode: (node: RestTypeNode<P>) => SyntaxPlan<RestTypeNode<P>, Stop, Image>;
  readonly ParenthesizedTypeNode: (node: ParenthesizedTypeNode<P>) => SyntaxPlan<ParenthesizedTypeNode<P>, Stop, Image>;
  readonly FunctionTypeNode: (node: FunctionTypeNode<P>) => SyntaxPlan<FunctionTypeNode<P>, Stop, Image>;
  readonly ConstructorTypeNode: (node: ConstructorTypeNode<P>) => SyntaxPlan<ConstructorTypeNode<P>, Stop, Image>;
  readonly TemplateLiteralTypeNode: (node: TemplateLiteralTypeNode<P>) => SyntaxPlan<TemplateLiteralTypeNode<P>, Stop, Image>;
  readonly TemplateLiteralTypeSpan: (node: TemplateLiteralTypeSpan<P>) => SyntaxPlan<TemplateLiteralTypeSpan<P>, Stop, Image>;
  readonly TypeParameterDeclaration: (node: TypeParameterDeclaration<P>) => SyntaxPlan<TypeParameterDeclaration<P>, Stop, Image>;
}

export function createTypesPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>, ports: () => SyntaxCopyPorts<P, Stop, Image>,
  structureOf: (node: TypeStructureSyntax<P>) => SyntaxStructureReceipt<P>): TypesPlans<P, Stop, Image> {
  const KeywordTypeNode = new Map<KeywordTypeNode<P>, SyntaxPlan<KeywordTypeNode<P>, Stop, Image>>();
  const UnionTypeNode = new Map<UnionTypeNode<P>, SyntaxPlan<UnionTypeNode<P>, Stop, Image>>();
  const IntersectionTypeNode = new Map<IntersectionTypeNode<P>, SyntaxPlan<IntersectionTypeNode<P>, Stop, Image>>();
  const ConditionalTypeNode = new Map<ConditionalTypeNode<P>, SyntaxPlan<ConditionalTypeNode<P>, Stop, Image>>();
  const TypeOperatorNode = new Map<TypeOperatorNode<P>, SyntaxPlan<TypeOperatorNode<P>, Stop, Image>>();
  const InferTypeNode = new Map<InferTypeNode<P>, SyntaxPlan<InferTypeNode<P>, Stop, Image>>();
  const ArrayTypeNode = new Map<ArrayTypeNode<P>, SyntaxPlan<ArrayTypeNode<P>, Stop, Image>>();
  const IndexedAccessTypeNode = new Map<IndexedAccessTypeNode<P>, SyntaxPlan<IndexedAccessTypeNode<P>, Stop, Image>>();
  const TypeReferenceNode = new Map<TypeReferenceNode<P>, SyntaxPlan<TypeReferenceNode<P>, Stop, Image>>();
  const LiteralTypeNode = new Map<LiteralTypeNode<P>, SyntaxPlan<LiteralTypeNode<P>, Stop, Image>>();
  const ThisTypeNode = new Map<ThisTypeNode<P>, SyntaxPlan<ThisTypeNode<P>, Stop, Image>>();
  const TypePredicateNode = new Map<TypePredicateNode<P>, SyntaxPlan<TypePredicateNode<P>, Stop, Image>>();
  const ImportAttribute = new Map<ImportAttribute<P>, SyntaxPlan<ImportAttribute<P>, Stop, Image>>();
  const ImportAttributes = new Map<ImportAttributes<P>, SyntaxPlan<ImportAttributes<P>, Stop, Image>>();
  const TypeQueryNode = new Map<TypeQueryNode<P>, SyntaxPlan<TypeQueryNode<P>, Stop, Image>>();
  const MappedTypeNode = new Map<MappedTypeNode<P>, SyntaxPlan<MappedTypeNode<P>, Stop, Image>>();
  const TypeLiteralNode = new Map<TypeLiteralNode<P>, SyntaxPlan<TypeLiteralNode<P>, Stop, Image>>();
  const TupleTypeNode = new Map<TupleTypeNode<P>, SyntaxPlan<TupleTypeNode<P>, Stop, Image>>();
  const NamedTupleMember = new Map<NamedTupleMember<P>, SyntaxPlan<NamedTupleMember<P>, Stop, Image>>();
  const OptionalTypeNode = new Map<OptionalTypeNode<P>, SyntaxPlan<OptionalTypeNode<P>, Stop, Image>>();
  const RestTypeNode = new Map<RestTypeNode<P>, SyntaxPlan<RestTypeNode<P>, Stop, Image>>();
  const ParenthesizedTypeNode = new Map<ParenthesizedTypeNode<P>, SyntaxPlan<ParenthesizedTypeNode<P>, Stop, Image>>();
  const FunctionTypeNode = new Map<FunctionTypeNode<P>, SyntaxPlan<FunctionTypeNode<P>, Stop, Image>>();
  const ConstructorTypeNode = new Map<ConstructorTypeNode<P>, SyntaxPlan<ConstructorTypeNode<P>, Stop, Image>>();
  const TemplateLiteralTypeNode = new Map<TemplateLiteralTypeNode<P>, SyntaxPlan<TemplateLiteralTypeNode<P>, Stop, Image>>();
  const TemplateLiteralTypeSpan = new Map<TemplateLiteralTypeSpan<P>, SyntaxPlan<TemplateLiteralTypeSpan<P>, Stop, Image>>();
  const TypeParameterDeclaration = new Map<TypeParameterDeclaration<P>, SyntaxPlan<TypeParameterDeclaration<P>, Stop, Image>>();
  function structure<Kind extends SyntaxStructureReceipt<P>["kind"]>(node: TypeStructureSyntax<P>, kind: Kind) {
    return requireSyntaxStructure<P, Kind>(structureOf(node), kind);
  }
  return {
    KeywordTypeNode: node => memoSyntaxPlan(KeywordTypeNode, node, () => withSyntaxPayload(phase.KeywordTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    UnionTypeNode: node => memoSyntaxPlan(UnionTypeNode, node, () => withSyntaxPayload(phase.UnionTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, types: structure(node, "type-vector").values(ports().TypeNode), tsonic });
    })),
    IntersectionTypeNode: node => memoSyntaxPlan(IntersectionTypeNode, node, () => withSyntaxPayload(phase.IntersectionTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, types: structure(node, "type-vector").values(ports().TypeNode), tsonic });
    })),
    ConditionalTypeNode: node => memoSyntaxPlan(ConditionalTypeNode, node, () => withSyntaxPayload(phase.ConditionalTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "conditional-type");
        return { ...header, kind, checkType: ports().TypeNode(fields.check()), extendsType: ports().TypeNode(fields.extends()),
          trueType: ports().TypeNode(fields.whenTrue()), falseType: ports().TypeNode(fields.whenFalse()), tsonic };
      };
    })),
    TypeOperatorNode: node => memoSyntaxPlan(TypeOperatorNode, node, () => withSyntaxPayload(phase.TypeOperatorNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, operator } = node;
      return tsonic => ({ ...header, kind, operator, type: ports().TypeNode(structure(node, "type-wrapper").value()), tsonic });
    })),
    InferTypeNode: node => memoSyntaxPlan(InferTypeNode, node, () => withSyntaxPayload(phase.InferTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, typeParameter: ports().TypeParameterDeclaration(structure(node, "infer-type").parameter()).read(), tsonic });
    })),
    ArrayTypeNode: node => memoSyntaxPlan(ArrayTypeNode, node, () => withSyntaxPayload(phase.ArrayTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, elementType: ports().TypeNode(structure(node, "type-wrapper").value()), tsonic });
    })),
    IndexedAccessTypeNode: node => memoSyntaxPlan(IndexedAccessTypeNode, node, () => withSyntaxPayload(phase.IndexedAccessTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "indexed-type");
        return { ...header, kind, objectType: ports().TypeNode(fields.object()), indexType: ports().TypeNode(fields.index()), tsonic };
      };
    })),
    TypeReferenceNode: node => memoSyntaxPlan(TypeReferenceNode, node, () => withSyntaxPayload(phase.TypeReferenceNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "named-type");
        return { ...header, kind, typeArguments: fields.arguments(ports().TypeNode), typeName: ports().EntityName(fields.name()), tsonic };
      };
    })),
    LiteralTypeNode: node => memoSyntaxPlan(LiteralTypeNode, node, () => withSyntaxPayload(phase.LiteralTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, literal: ports().LiteralTypeChild(structure(node, "literal-type").literal()), tsonic });
    })),
    ThisTypeNode: node => memoSyntaxPlan(ThisTypeNode, node, () => withSyntaxPayload(phase.ThisTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    TypePredicateNode: node => memoSyntaxPlan(TypePredicateNode, node, () => withSyntaxPayload(phase.TypePredicateNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, assertsModifier } = node;
      return tsonic => ({
        ...header,
        kind,
        assertsModifier,
        parameterName: ports().TypePredicateParameterName(node.parameterName),
        type: node.type === null ? null : ports().TypeNode(node.type),
        tsonic,
      });
    })),
    ImportAttribute: node => memoSyntaxPlan(ImportAttribute, node, () => withSyntaxPayload(phase.ImportAttribute, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().ImportAttributeName(node.name),
        value: ports().Expression(node.value),
        tsonic,
      });
    })),
    ImportAttributes: node => memoSyntaxPlan(ImportAttributes, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, token, multiLine } = node;
      return tsonic => ({
        ...header,
        kind,
        token,
        attributes: copyNodeList(node.attributes, item => ports().ImportAttribute(item).read()),
        multiLine,
        tsonic,
      });
    })),
    TypeQueryNode: node => memoSyntaxPlan(TypeQueryNode, node, () => withSyntaxPayload(phase.TypeQueryNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "named-type");
        return { ...header, kind, typeArguments: fields.arguments(ports().TypeNode), exprName: ports().EntityName(fields.name()), tsonic };
      };
    })),
    MappedTypeNode: node => memoSyntaxPlan(MappedTypeNode, node, () => withSyntaxPayload(phase.MappedTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, readonlyToken, questionToken } = node;
      return tsonic => ({
        ...header,
        kind,
        readonlyToken,
        typeParameter: ports().TypeParameterDeclaration(node.typeParameter).read(),
        nameType: node.nameType === null ? null : ports().TypeNode(node.nameType),
        questionToken,
        type: node.type === null ? null : ports().TypeNode(node.type),
        members: node.members === null ? null : copyNodeList(node.members, item => ports().TypeElement(item)),
        tsonic,
      });
    })),
    TypeLiteralNode: node => memoSyntaxPlan(TypeLiteralNode, node, () => withSyntaxPayload(phase.TypeLiteralNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, members: structure(node, "type-members").members(ports().TypeElement), tsonic });
    })),
    TupleTypeNode: node => memoSyntaxPlan(TupleTypeNode, node, () => withSyntaxPayload(phase.TupleTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, elements: structure(node, "type-vector").values(ports().TypeNode), tsonic });
    })),
    NamedTupleMember: node => memoSyntaxPlan(NamedTupleMember, node, () => withSyntaxPayload(phase.NamedTupleMember, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "named-tuple");
        return { ...header, kind, dotDotDotToken: fields.dots(), name: ports().Identifier(fields.name()).read(),
          questionToken: fields.question(), type: ports().TypeNode(fields.type()), tsonic };
      };
    })),
    OptionalTypeNode: node => memoSyntaxPlan(OptionalTypeNode, node, () => withSyntaxPayload(phase.OptionalTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, type: ports().TypeNode(structure(node, "type-wrapper").value()), tsonic });
    })),
    RestTypeNode: node => memoSyntaxPlan(RestTypeNode, node, () => withSyntaxPayload(phase.RestTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, type: ports().TypeNode(structure(node, "type-wrapper").value()), tsonic });
    })),
    ParenthesizedTypeNode: node => memoSyntaxPlan(ParenthesizedTypeNode, node, () => withSyntaxPayload(phase.ParenthesizedTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, type: ports().TypeNode(structure(node, "type-wrapper").value()), tsonic });
    })),
    FunctionTypeNode: node => memoSyntaxPlan(FunctionTypeNode, node, () => withSyntaxPayload(phase.FunctionTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature),
        tsonic,
      });
    })),
    ConstructorTypeNode: node => memoSyntaxPlan(ConstructorTypeNode, node, () => withSyntaxPayload(phase.ConstructorTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature),
        tsonic,
      });
    })),
    TemplateLiteralTypeNode: node => memoSyntaxPlan(TemplateLiteralTypeNode, node, () => withSyntaxPayload(phase.TemplateLiteralTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        head: ports().TemplateHead(node.head).read(),
        templateSpans: copyNodeList(node.templateSpans, item => ports().TemplateLiteralTypeSpan(item).read()),
        tsonic,
      });
    })),
    TemplateLiteralTypeSpan: node => memoSyntaxPlan(TemplateLiteralTypeSpan, node, () => withSyntaxPayload(phase.TemplateLiteralTypeSpan, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type),
        literal: ports().TemplateMiddleOrTail(node.literal),
        tsonic,
      });
    })),
    TypeParameterDeclaration: node => memoSyntaxPlan(TypeParameterDeclaration, node, () => withSyntaxPayload(phase.TypeParameterDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)),
        name: ports().Identifier(node.name).read(),
        constraint: node.constraint === null ? null : ports().TypeNode(node.constraint),
        expression: node.expression === null ? null : ports().Expression(node.expression),
        defaultType: node.defaultType === null ? null : ports().TypeNode(node.defaultType),
        tsonic,
      });
    })),
  };
}

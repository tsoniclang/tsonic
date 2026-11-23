import type {
  KeywordTypeNode, UnionTypeNode, IntersectionTypeNode, ConditionalTypeNode, TypeOperatorNode,
  InferTypeNode, ArrayTypeNode, IndexedAccessTypeNode, TypeReferenceNode, LiteralTypeNode,
  ThisTypeNode, TypePredicateNode, ImportAttribute, ImportAttributes, TypeQueryNode,
  MappedTypeNode, TypeLiteralNode, TupleTypeNode, NamedTupleMember, OptionalTypeNode,
  RestTypeNode, ParenthesizedTypeNode, FunctionTypeNode, ConstructorTypeNode, TemplateLiteralTypeNode,
  TemplateLiteralTypeSpan, TypeParameterDeclaration,
  Phase, SyntaxPhaseCopy,
} from "./contract.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { holdSyntaxPayload, copyNodeList, memoSyntaxPlan, syntaxHeader, withSyntaxPayload } from "./copy-node.js";

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

export function createTypesPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>, ports: () => SyntaxCopyPorts<P, Stop, Image>): TypesPlans<P, Stop, Image> {
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
  return {
    KeywordTypeNode: node => memoSyntaxPlan(KeywordTypeNode, node, () => withSyntaxPayload(phase.KeywordTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic,
    }))),
    UnionTypeNode: node => memoSyntaxPlan(UnionTypeNode, node, () => withSyntaxPayload(phase.UnionTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      types: copyNodeList(node.types, item => ports().TypeNode(item).read()),
      tsonic,
    }))),
    IntersectionTypeNode: node => memoSyntaxPlan(IntersectionTypeNode, node, () => withSyntaxPayload(phase.IntersectionTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      types: copyNodeList(node.types, item => ports().TypeNode(item).read()),
      tsonic,
    }))),
    ConditionalTypeNode: node => memoSyntaxPlan(ConditionalTypeNode, node, () => withSyntaxPayload(phase.ConditionalTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      checkType: ports().TypeNode(node.checkType).read(),
      extendsType: ports().TypeNode(node.extendsType).read(),
      trueType: ports().TypeNode(node.trueType).read(),
      falseType: ports().TypeNode(node.falseType).read(),
      tsonic,
    }))),
    TypeOperatorNode: node => memoSyntaxPlan(TypeOperatorNode, node, () => withSyntaxPayload(phase.TypeOperatorNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      operator: node.operator,
      type: ports().TypeNode(node.type).read(),
      tsonic,
    }))),
    InferTypeNode: node => memoSyntaxPlan(InferTypeNode, node, () => withSyntaxPayload(phase.InferTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeParameter: ports().TypeParameterDeclaration(node.typeParameter).read(),
      tsonic,
    }))),
    ArrayTypeNode: node => memoSyntaxPlan(ArrayTypeNode, node, () => withSyntaxPayload(phase.ArrayTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elementType: ports().TypeNode(node.elementType).read(),
      tsonic,
    }))),
    IndexedAccessTypeNode: node => memoSyntaxPlan(IndexedAccessTypeNode, node, () => withSyntaxPayload(phase.IndexedAccessTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      objectType: ports().TypeNode(node.objectType).read(),
      indexType: ports().TypeNode(node.indexType).read(),
      tsonic,
    }))),
    TypeReferenceNode: node => memoSyntaxPlan(TypeReferenceNode, node, () => withSyntaxPayload(phase.TypeReferenceNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
      typeName: ports().EntityName(node.typeName).read(),
      tsonic,
    }))),
    LiteralTypeNode: node => memoSyntaxPlan(LiteralTypeNode, node, () => withSyntaxPayload(phase.LiteralTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      literal: ports().LiteralTypeChild(node.literal).read(),
      tsonic,
    }))),
    ThisTypeNode: node => memoSyntaxPlan(ThisTypeNode, node, () => withSyntaxPayload(phase.ThisTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic,
    }))),
    TypePredicateNode: node => memoSyntaxPlan(TypePredicateNode, node, () => withSyntaxPayload(phase.TypePredicateNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      assertsModifier: node.assertsModifier,
      parameterName: ports().TypePredicateParameterName(node.parameterName).read(),
      type: node.type === null ? null : ports().TypeNode(node.type).read(),
      tsonic,
    }))),
    ImportAttribute: node => memoSyntaxPlan(ImportAttribute, node, () => withSyntaxPayload(phase.ImportAttribute, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      name: ports().ImportAttributeName(node.name).read(),
      value: ports().Expression(node.value).read(),
      tsonic,
    }))),
    ImportAttributes: node => memoSyntaxPlan(ImportAttributes, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      token: node.token,
      attributes: copyNodeList(node.attributes, item => ports().ImportAttribute(item).read()),
      multiLine: node.multiLine,
      tsonic,
    }))),
    TypeQueryNode: node => memoSyntaxPlan(TypeQueryNode, node, () => withSyntaxPayload(phase.TypeQueryNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
      exprName: ports().EntityName(node.exprName).read(),
      tsonic,
    }))),
    MappedTypeNode: node => memoSyntaxPlan(MappedTypeNode, node, () => withSyntaxPayload(phase.MappedTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      readonlyToken: node.readonlyToken,
      typeParameter: ports().TypeParameterDeclaration(node.typeParameter).read(),
      nameType: node.nameType === null ? null : ports().TypeNode(node.nameType).read(),
      questionToken: node.questionToken,
      type: node.type === null ? null : ports().TypeNode(node.type).read(),
      members: node.members === null ? null : copyNodeList(node.members, item => ports().TypeElement(item).read()),
      tsonic,
    }))),
    TypeLiteralNode: node => memoSyntaxPlan(TypeLiteralNode, node, () => withSyntaxPayload(phase.TypeLiteralNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      members: copyNodeList(node.members, item => ports().TypeElement(item).read()),
      tsonic,
    }))),
    TupleTypeNode: node => memoSyntaxPlan(TupleTypeNode, node, () => withSyntaxPayload(phase.TupleTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elements: copyNodeList(node.elements, item => ports().TypeNode(item).read()),
      tsonic,
    }))),
    NamedTupleMember: node => memoSyntaxPlan(NamedTupleMember, node, () => withSyntaxPayload(phase.NamedTupleMember, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      dotDotDotToken: node.dotDotDotToken,
      name: ports().Identifier(node.name).read(),
      questionToken: node.questionToken,
      type: ports().TypeNode(node.type).read(),
      tsonic,
    }))),
    OptionalTypeNode: node => memoSyntaxPlan(OptionalTypeNode, node, () => withSyntaxPayload(phase.OptionalTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type).read(),
      tsonic,
    }))),
    RestTypeNode: node => memoSyntaxPlan(RestTypeNode, node, () => withSyntaxPayload(phase.RestTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type).read(),
      tsonic,
    }))),
    ParenthesizedTypeNode: node => memoSyntaxPlan(ParenthesizedTypeNode, node, () => withSyntaxPayload(phase.ParenthesizedTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type).read(),
      tsonic,
    }))),
    FunctionTypeNode: node => memoSyntaxPlan(FunctionTypeNode, node, () => withSyntaxPayload(phase.FunctionTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
      type: node.type === null ? null : ports().TypeNode(node.type).read(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
      tsonic,
    }))),
    ConstructorTypeNode: node => memoSyntaxPlan(ConstructorTypeNode, node, () => withSyntaxPayload(phase.ConstructorTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
      type: node.type === null ? null : ports().TypeNode(node.type).read(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
      tsonic,
    }))),
    TemplateLiteralTypeNode: node => memoSyntaxPlan(TemplateLiteralTypeNode, node, () => withSyntaxPayload(phase.TemplateLiteralTypeNode, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      head: ports().TemplateHead(node.head).read(),
      templateSpans: copyNodeList(node.templateSpans, item => ports().TemplateLiteralTypeSpan(item).read()),
      tsonic,
    }))),
    TemplateLiteralTypeSpan: node => memoSyntaxPlan(TemplateLiteralTypeSpan, node, () => withSyntaxPayload(phase.TemplateLiteralTypeSpan, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type).read(),
      literal: ports().TemplateMiddleOrTail(node.literal).read(),
      tsonic,
    }))),
    TypeParameterDeclaration: node => memoSyntaxPlan(TypeParameterDeclaration, node, () => withSyntaxPayload(phase.TypeParameterDeclaration, node.tsonic, tsonic => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
      name: ports().Identifier(node.name).read(),
      constraint: node.constraint === null ? null : ports().TypeNode(node.constraint).read(),
      expression: node.expression === null ? null : ports().Expression(node.expression).read(),
      defaultType: node.defaultType === null ? null : ports().TypeNode(node.defaultType).read(),
      tsonic,
    }))),
  };
}

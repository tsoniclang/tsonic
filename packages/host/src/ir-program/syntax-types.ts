import type {
  KeywordTypeNode, UnionTypeNode, IntersectionTypeNode, ConditionalTypeNode, TypeOperatorNode,
  InferTypeNode, ArrayTypeNode, IndexedAccessTypeNode, TypeReferenceNode, LiteralTypeNode,
  ThisTypeNode, TypePredicateNode, ImportAttribute, ImportAttributes, TypeQueryNode,
  MappedTypeNode, TypeLiteralNode, TupleTypeNode, NamedTupleMember, OptionalTypeNode,
  RestTypeNode, ParenthesizedTypeNode, FunctionTypeNode, ConstructorTypeNode, TemplateLiteralTypeNode,
  TemplateLiteralTypeSpan, TypeParameterDeclaration,
} from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./syntax-arena.js";
import { copyNodeList, memoSyntaxPlan, syntaxHeader } from "./syntax-arena.js";
import {
  rewriteType, rewritePredicate, rewriteTypeParameter,
} from "./canonical-phase.js";

export interface TypesPlans {
  readonly KeywordTypeNode: (node: KeywordTypeNode<TypedPhase>) => SyntaxPlan<KeywordTypeNode<TypedPhase>>;
  readonly UnionTypeNode: (node: UnionTypeNode<TypedPhase>) => SyntaxPlan<UnionTypeNode<TypedPhase>>;
  readonly IntersectionTypeNode: (node: IntersectionTypeNode<TypedPhase>) => SyntaxPlan<IntersectionTypeNode<TypedPhase>>;
  readonly ConditionalTypeNode: (node: ConditionalTypeNode<TypedPhase>) => SyntaxPlan<ConditionalTypeNode<TypedPhase>>;
  readonly TypeOperatorNode: (node: TypeOperatorNode<TypedPhase>) => SyntaxPlan<TypeOperatorNode<TypedPhase>>;
  readonly InferTypeNode: (node: InferTypeNode<TypedPhase>) => SyntaxPlan<InferTypeNode<TypedPhase>>;
  readonly ArrayTypeNode: (node: ArrayTypeNode<TypedPhase>) => SyntaxPlan<ArrayTypeNode<TypedPhase>>;
  readonly IndexedAccessTypeNode: (node: IndexedAccessTypeNode<TypedPhase>) => SyntaxPlan<IndexedAccessTypeNode<TypedPhase>>;
  readonly TypeReferenceNode: (node: TypeReferenceNode<TypedPhase>) => SyntaxPlan<TypeReferenceNode<TypedPhase>>;
  readonly LiteralTypeNode: (node: LiteralTypeNode<TypedPhase>) => SyntaxPlan<LiteralTypeNode<TypedPhase>>;
  readonly ThisTypeNode: (node: ThisTypeNode<TypedPhase>) => SyntaxPlan<ThisTypeNode<TypedPhase>>;
  readonly TypePredicateNode: (node: TypePredicateNode<TypedPhase>) => SyntaxPlan<TypePredicateNode<TypedPhase>>;
  readonly ImportAttribute: (node: ImportAttribute<TypedPhase>) => SyntaxPlan<ImportAttribute<TypedPhase>>;
  readonly ImportAttributes: (node: ImportAttributes<TypedPhase>) => SyntaxPlan<ImportAttributes<TypedPhase>>;
  readonly TypeQueryNode: (node: TypeQueryNode<TypedPhase>) => SyntaxPlan<TypeQueryNode<TypedPhase>>;
  readonly MappedTypeNode: (node: MappedTypeNode<TypedPhase>) => SyntaxPlan<MappedTypeNode<TypedPhase>>;
  readonly TypeLiteralNode: (node: TypeLiteralNode<TypedPhase>) => SyntaxPlan<TypeLiteralNode<TypedPhase>>;
  readonly TupleTypeNode: (node: TupleTypeNode<TypedPhase>) => SyntaxPlan<TupleTypeNode<TypedPhase>>;
  readonly NamedTupleMember: (node: NamedTupleMember<TypedPhase>) => SyntaxPlan<NamedTupleMember<TypedPhase>>;
  readonly OptionalTypeNode: (node: OptionalTypeNode<TypedPhase>) => SyntaxPlan<OptionalTypeNode<TypedPhase>>;
  readonly RestTypeNode: (node: RestTypeNode<TypedPhase>) => SyntaxPlan<RestTypeNode<TypedPhase>>;
  readonly ParenthesizedTypeNode: (node: ParenthesizedTypeNode<TypedPhase>) => SyntaxPlan<ParenthesizedTypeNode<TypedPhase>>;
  readonly FunctionTypeNode: (node: FunctionTypeNode<TypedPhase>) => SyntaxPlan<FunctionTypeNode<TypedPhase>>;
  readonly ConstructorTypeNode: (node: ConstructorTypeNode<TypedPhase>) => SyntaxPlan<ConstructorTypeNode<TypedPhase>>;
  readonly TemplateLiteralTypeNode: (node: TemplateLiteralTypeNode<TypedPhase>) => SyntaxPlan<TemplateLiteralTypeNode<TypedPhase>>;
  readonly TemplateLiteralTypeSpan: (node: TemplateLiteralTypeSpan<TypedPhase>) => SyntaxPlan<TemplateLiteralTypeSpan<TypedPhase>>;
  readonly TypeParameterDeclaration: (node: TypeParameterDeclaration<TypedPhase>) => SyntaxPlan<TypeParameterDeclaration<TypedPhase>>;
}

export function createTypesPlans(rewrite: TypeRewrite, ports: () => SyntaxCopyPorts): TypesPlans {
  const KeywordTypeNode = new Map<KeywordTypeNode<TypedPhase>, SyntaxPlan<KeywordTypeNode<TypedPhase>>>();
  const UnionTypeNode = new Map<UnionTypeNode<TypedPhase>, SyntaxPlan<UnionTypeNode<TypedPhase>>>();
  const IntersectionTypeNode = new Map<IntersectionTypeNode<TypedPhase>, SyntaxPlan<IntersectionTypeNode<TypedPhase>>>();
  const ConditionalTypeNode = new Map<ConditionalTypeNode<TypedPhase>, SyntaxPlan<ConditionalTypeNode<TypedPhase>>>();
  const TypeOperatorNode = new Map<TypeOperatorNode<TypedPhase>, SyntaxPlan<TypeOperatorNode<TypedPhase>>>();
  const InferTypeNode = new Map<InferTypeNode<TypedPhase>, SyntaxPlan<InferTypeNode<TypedPhase>>>();
  const ArrayTypeNode = new Map<ArrayTypeNode<TypedPhase>, SyntaxPlan<ArrayTypeNode<TypedPhase>>>();
  const IndexedAccessTypeNode = new Map<IndexedAccessTypeNode<TypedPhase>, SyntaxPlan<IndexedAccessTypeNode<TypedPhase>>>();
  const TypeReferenceNode = new Map<TypeReferenceNode<TypedPhase>, SyntaxPlan<TypeReferenceNode<TypedPhase>>>();
  const LiteralTypeNode = new Map<LiteralTypeNode<TypedPhase>, SyntaxPlan<LiteralTypeNode<TypedPhase>>>();
  const ThisTypeNode = new Map<ThisTypeNode<TypedPhase>, SyntaxPlan<ThisTypeNode<TypedPhase>>>();
  const TypePredicateNode = new Map<TypePredicateNode<TypedPhase>, SyntaxPlan<TypePredicateNode<TypedPhase>>>();
  const ImportAttribute = new Map<ImportAttribute<TypedPhase>, SyntaxPlan<ImportAttribute<TypedPhase>>>();
  const ImportAttributes = new Map<ImportAttributes<TypedPhase>, SyntaxPlan<ImportAttributes<TypedPhase>>>();
  const TypeQueryNode = new Map<TypeQueryNode<TypedPhase>, SyntaxPlan<TypeQueryNode<TypedPhase>>>();
  const MappedTypeNode = new Map<MappedTypeNode<TypedPhase>, SyntaxPlan<MappedTypeNode<TypedPhase>>>();
  const TypeLiteralNode = new Map<TypeLiteralNode<TypedPhase>, SyntaxPlan<TypeLiteralNode<TypedPhase>>>();
  const TupleTypeNode = new Map<TupleTypeNode<TypedPhase>, SyntaxPlan<TupleTypeNode<TypedPhase>>>();
  const NamedTupleMember = new Map<NamedTupleMember<TypedPhase>, SyntaxPlan<NamedTupleMember<TypedPhase>>>();
  const OptionalTypeNode = new Map<OptionalTypeNode<TypedPhase>, SyntaxPlan<OptionalTypeNode<TypedPhase>>>();
  const RestTypeNode = new Map<RestTypeNode<TypedPhase>, SyntaxPlan<RestTypeNode<TypedPhase>>>();
  const ParenthesizedTypeNode = new Map<ParenthesizedTypeNode<TypedPhase>, SyntaxPlan<ParenthesizedTypeNode<TypedPhase>>>();
  const FunctionTypeNode = new Map<FunctionTypeNode<TypedPhase>, SyntaxPlan<FunctionTypeNode<TypedPhase>>>();
  const ConstructorTypeNode = new Map<ConstructorTypeNode<TypedPhase>, SyntaxPlan<ConstructorTypeNode<TypedPhase>>>();
  const TemplateLiteralTypeNode = new Map<TemplateLiteralTypeNode<TypedPhase>, SyntaxPlan<TemplateLiteralTypeNode<TypedPhase>>>();
  const TemplateLiteralTypeSpan = new Map<TemplateLiteralTypeSpan<TypedPhase>, SyntaxPlan<TemplateLiteralTypeSpan<TypedPhase>>>();
  const TypeParameterDeclaration = new Map<TypeParameterDeclaration<TypedPhase>, SyntaxPlan<TypeParameterDeclaration<TypedPhase>>>();
  return {
    KeywordTypeNode: node => memoSyntaxPlan(KeywordTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    UnionTypeNode: node => memoSyntaxPlan(UnionTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      types: copyNodeList(node.types, item => ports().TypeNode(item)()),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    IntersectionTypeNode: node => memoSyntaxPlan(IntersectionTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      types: copyNodeList(node.types, item => ports().TypeNode(item)()),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    ConditionalTypeNode: node => memoSyntaxPlan(ConditionalTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      checkType: ports().TypeNode(node.checkType)(),
      extendsType: ports().TypeNode(node.extendsType)(),
      trueType: ports().TypeNode(node.trueType)(),
      falseType: ports().TypeNode(node.falseType)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TypeOperatorNode: node => memoSyntaxPlan(TypeOperatorNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      operator: node.operator,
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    InferTypeNode: node => memoSyntaxPlan(InferTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeParameter: ports().TypeParameterDeclaration(node.typeParameter)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    ArrayTypeNode: node => memoSyntaxPlan(ArrayTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elementType: ports().TypeNode(node.elementType)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    IndexedAccessTypeNode: node => memoSyntaxPlan(IndexedAccessTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      objectType: ports().TypeNode(node.objectType)(),
      indexType: ports().TypeNode(node.indexType)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TypeReferenceNode: node => memoSyntaxPlan(TypeReferenceNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      typeName: ports().EntityName(node.typeName)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    LiteralTypeNode: node => memoSyntaxPlan(LiteralTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      literal: ports().LiteralTypeChild(node.literal)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    ThisTypeNode: node => memoSyntaxPlan(ThisTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TypePredicateNode: node => memoSyntaxPlan(TypePredicateNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      assertsModifier: node.assertsModifier,
      parameterName: ports().TypePredicateParameterName(node.parameterName)(),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      tsonic: rewritePredicate(rewrite, node.tsonic),
    })),
    ImportAttribute: node => memoSyntaxPlan(ImportAttribute, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      name: ports().ImportAttributeName(node.name)(),
      value: ports().Expression(node.value)(),
      tsonic: node.tsonic,
    })),
    ImportAttributes: node => memoSyntaxPlan(ImportAttributes, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      token: node.token,
      attributes: copyNodeList(node.attributes, item => ports().ImportAttribute(item)()),
      multiLine: node.multiLine,
      tsonic: node.tsonic,
    })),
    TypeQueryNode: node => memoSyntaxPlan(TypeQueryNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      exprName: ports().EntityName(node.exprName)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    MappedTypeNode: node => memoSyntaxPlan(MappedTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      readonlyToken: node.readonlyToken,
      typeParameter: ports().TypeParameterDeclaration(node.typeParameter)(),
      nameType: node.nameType === null ? null : ports().TypeNode(node.nameType)(),
      questionToken: node.questionToken,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      members: node.members === null ? null : copyNodeList(node.members, item => ports().TypeElement(item)()),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TypeLiteralNode: node => memoSyntaxPlan(TypeLiteralNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      members: copyNodeList(node.members, item => ports().TypeElement(item)()),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TupleTypeNode: node => memoSyntaxPlan(TupleTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elements: copyNodeList(node.elements, item => ports().TypeNode(item)()),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    NamedTupleMember: node => memoSyntaxPlan(NamedTupleMember, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      dotDotDotToken: node.dotDotDotToken,
      name: ports().Identifier(node.name)(),
      questionToken: node.questionToken,
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    OptionalTypeNode: node => memoSyntaxPlan(OptionalTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    RestTypeNode: node => memoSyntaxPlan(RestTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    ParenthesizedTypeNode: node => memoSyntaxPlan(ParenthesizedTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    FunctionTypeNode: node => memoSyntaxPlan(FunctionTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    ConstructorTypeNode: node => memoSyntaxPlan(ConstructorTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TemplateLiteralTypeNode: node => memoSyntaxPlan(TemplateLiteralTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      head: ports().TemplateHead(node.head)(),
      templateSpans: copyNodeList(node.templateSpans, item => ports().TemplateLiteralTypeSpan(item)()),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TemplateLiteralTypeSpan: node => memoSyntaxPlan(TemplateLiteralTypeSpan, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      literal: ports().TemplateMiddleOrTail(node.literal)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    TypeParameterDeclaration: node => memoSyntaxPlan(TypeParameterDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().Identifier(node.name)(),
      constraint: node.constraint === null ? null : ports().TypeNode(node.constraint)(),
      expression: node.expression === null ? null : ports().Expression(node.expression)(),
      defaultType: node.defaultType === null ? null : ports().TypeNode(node.defaultType)(),
      tsonic: rewriteTypeParameter(rewrite, node.tsonic),
    })),
  };
}

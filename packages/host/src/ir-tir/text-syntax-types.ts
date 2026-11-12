import { constructKeywordTypeNode } from "./text-syntax-construction.js";
import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  TypedCallable, TypedIndexDeclaration, TypedPhase, TypedPredicate, TypedStorageDeclaration, TypedType, TypedTypeParameter, TypedValue
} from "./contract.js";
import type {
  Origin
} from "../ids/contract.js";
import type {
  ArrayTypeNode, CallSignatureDeclaration, ConditionalTypeNode, ConstructSignatureDeclaration, ConstructorTypeNode, ExpressionWithTypeArguments, FunctionTypeNode, ImportTypeNode, IndexSignatureDeclaration, IndexedAccessTypeNode, InferTypeNode, IntersectionTypeNode, KeywordTypeNode, LiteralTypeNode, MappedTypeNode, MethodSignatureDeclaration, ModifierList, NamedTupleMember, NodeList, OptionalTypeNode, ParameterDeclaration, ParenthesizedTypeNode, PropertySignatureDeclaration, RestTypeNode, TemplateLiteralTypeNode, TemplateLiteralTypeSpan, TextRange, ThisTypeNode, TupleTypeNode, TypeAssertion, TypeElement, TypeLiteralNode, TypeNode, TypeOperatorNode, TypeParameterDeclaration, TypePredicateNode, TypeQueryNode, TypeReferenceNode, UnionTypeNode
} from "../ir-hir/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, syntaxReference, nullableWork, sequenceWork } from "./text-layouts.js";

export interface SyntaxTypesTextReads {
  readonly work_L_ParameterDeclaration_: TirRecordCodec<NodeList<ParameterDeclaration<TypedPhase>>>;
  readonly work_ModifierList: TirRecordCodec<ModifierList<TypedPhase>>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
  readonly work_TypedCallable: TirRecordCodec<TypedCallable>;
  readonly work_TypedIndexDeclaration: TirRecordCodec<TypedIndexDeclaration>;
  readonly work_TypedPredicate: TirRecordCodec<TypedPredicate>;
  readonly work_TypedStorageDeclaration: TirRecordCodec<TypedStorageDeclaration>;
  readonly work_TypedType: TirRecordCodec<TypedType>;
  readonly work_TypedTypeParameter: TirRecordCodec<TypedTypeParameter>;
  readonly work_TypedValue: TirRecordCodec<TypedValue>;
}

export interface SyntaxTypesTextModel {
  readonly work_CallSignatureDeclaration: (value: CallSignatureDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ConstructSignatureDeclaration: (value: ConstructSignatureDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_IndexSignatureDeclaration: (value: IndexSignatureDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_MethodSignatureDeclaration: (value: MethodSignatureDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_PropertySignatureDeclaration: (value: PropertySignatureDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeAssertion: (value: TypeAssertion<TypedPhase>) => TirTypedRecordWork;
  readonly work_KeywordTypeNode: (value: KeywordTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_UnionTypeNode: (value: UnionTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_IntersectionTypeNode: (value: IntersectionTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_ConditionalTypeNode: (value: ConditionalTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeOperatorNode: (value: TypeOperatorNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_InferTypeNode: (value: InferTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_ArrayTypeNode: (value: ArrayTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_IndexedAccessTypeNode: (value: IndexedAccessTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeReferenceNode: (value: TypeReferenceNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_LiteralTypeNode: (value: LiteralTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_ThisTypeNode: (value: ThisTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypePredicateNode: (value: TypePredicateNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeQueryNode: (value: TypeQueryNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_MappedTypeNode: (value: MappedTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeLiteralNode: (value: TypeLiteralNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TupleTypeNode: (value: TupleTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_NamedTupleMember: (value: NamedTupleMember<TypedPhase>) => TirTypedRecordWork;
  readonly work_OptionalTypeNode: (value: OptionalTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_RestTypeNode: (value: RestTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_ParenthesizedTypeNode: (value: ParenthesizedTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_FunctionTypeNode: (value: FunctionTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_ConstructorTypeNode: (value: ConstructorTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TemplateLiteralTypeNode: (value: TemplateLiteralTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_ImportTypeNode: (value: ImportTypeNode<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeParameterDeclaration: (value: TypeParameterDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_L_TypeParameterDeclaration_: TirRecordCodec<NodeList<TypeParameterDeclaration<TypedPhase>>>;
  readonly work_L_ExpressionWithTypeArguments_: TirRecordCodec<NodeList<ExpressionWithTypeArguments<TypedPhase>>>;
  readonly work_L_TypeElement_: TirRecordCodec<NodeList<TypeElement<TypedPhase>>>;
  readonly work_L_TypeNode_: TirRecordCodec<NodeList<TypeNode<TypedPhase>>>;
  readonly work_L_TemplateLiteralTypeSpan_: TirRecordCodec<NodeList<TemplateLiteralTypeSpan<TypedPhase>>>;
}

export const createSyntaxTypesText = (kernel: TirTextKernel, read: SyntaxTypesTextReads): SyntaxTypesTextModel => {
  const { defineRecord, defineSyntaxRecord, syntaxReads, booleanReader } = kernel;
  const work_CallSignatureDeclaration: (value: CallSignatureDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<CallSignatureDeclaration<TypedPhase>>("CallSignatureDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'CallSignature", literalReader<(CallSignatureDeclaration<TypedPhase>)["kind"]>("'CallSignature", ["CallSignature"]))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => work_L_TypeParameterDeclaration_(actual)), nullableReader(lazyReader(() => work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, typeParameters: field_typeParameters, parameters: field_parameters, type: field_type,
      fullSignature: field_fullSignature, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ConstructSignatureDeclaration: (value: ConstructSignatureDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ConstructSignatureDeclaration<TypedPhase>>("ConstructSignatureDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ConstructSignature", literalReader<(ConstructSignatureDeclaration<TypedPhase>)["kind"]>("'ConstructSignature", ["ConstructSignature"]))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => work_L_TypeParameterDeclaration_(actual)), nullableReader(lazyReader(() => work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, typeParameters: field_typeParameters, parameters: field_parameters, type: field_type,
      fullSignature: field_fullSignature, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_IndexSignatureDeclaration: (value: IndexSignatureDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<IndexSignatureDeclaration<TypedPhase>>("IndexSignatureDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'IndexSignature", literalReader<(IndexSignatureDeclaration<TypedPhase>)["kind"]>("'IndexSignature", ["IndexSignature"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => work_L_TypeParameterDeclaration_(actual)), nullableReader(lazyReader(() => work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedIndexDeclaration", value => read.work_TypedIndexDeclaration(value.tsonic), lazyReader(() => read.work_TypedIndexDeclaration.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, typeParameters: field_typeParameters, parameters: field_parameters,
      type: field_type, fullSignature: field_fullSignature, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_MethodSignatureDeclaration: (value: MethodSignatureDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<MethodSignatureDeclaration<TypedPhase>>("MethodSignatureDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'MethodSignature", literalReader<(MethodSignatureDeclaration<TypedPhase>)["kind"]>("'MethodSignature", ["MethodSignature"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => work_L_TypeParameterDeclaration_(actual)), nullableReader(lazyReader(() => work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken,
      typeParameters: field_typeParameters, parameters: field_parameters, type: field_type, fullSignature: field_fullSignature,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_PropertySignatureDeclaration: (value: PropertySignatureDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PropertySignatureDeclaration<TypedPhase>>("PropertySignatureDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PropertySignature", literalReader<(PropertySignatureDeclaration<TypedPhase>)["kind"]>("'PropertySignature", ["PropertySignature"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("initializer", "?$Expression", value => nullableWork(value.initializer, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedStorageDeclaration", value => read.work_TypedStorageDeclaration(value.tsonic), lazyReader(() => read.work_TypedStorageDeclaration.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken, type: field_type,
      initializer: field_initializer, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TypeAssertion: (value: TypeAssertion<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeAssertion<TypedPhase>>("TypeAssertion", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypeAssertionExpression", literalReader<(TypeAssertion<TypedPhase>)["kind"]>("'TypeAssertionExpression", ["TypeAssertionExpression"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedValue", value => read.work_TypedValue(value.tsonic), lazyReader(() => read.work_TypedValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_expression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_KeywordTypeNode: (value: KeywordTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<KeywordTypeNode<TypedPhase>>("KeywordTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "KeywordTypeKind", literalReader<(KeywordTypeNode<TypedPhase>)["kind"]>("KeywordTypeKind", ["AnyKeyword","BigIntKeyword","BooleanKeyword","IntrinsicKeyword","NeverKeyword","NumberKeyword","ObjectKeyword","StringKeyword","SymbolKeyword","UndefinedKeyword","UnknownKeyword","VoidKeyword"]))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), constructKeywordTypeNode));
  const work_UnionTypeNode: (value: UnionTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<UnionTypeNode<TypedPhase>>("UnionTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'UnionType", literalReader<(UnionTypeNode<TypedPhase>)["kind"]>("'UnionType", ["UnionType"]))
    .field("types", "L<TypeNode>", value => work_L_TypeNode_(value.types), lazyReader(() => work_L_TypeNode_.reader))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_types, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, types: field_types, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_IntersectionTypeNode: (value: IntersectionTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<IntersectionTypeNode<TypedPhase>>("IntersectionTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'IntersectionType", literalReader<(IntersectionTypeNode<TypedPhase>)["kind"]>("'IntersectionType", ["IntersectionType"]))
    .field("types", "L<TypeNode>", value => work_L_TypeNode_(value.types), lazyReader(() => work_L_TypeNode_.reader))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_types, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, types: field_types, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ConditionalTypeNode: (value: ConditionalTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ConditionalTypeNode<TypedPhase>>("ConditionalTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ConditionalType", literalReader<(ConditionalTypeNode<TypedPhase>)["kind"]>("'ConditionalType", ["ConditionalType"]))
    .field("checkType", "$TypeNode", value => syntaxReference("$TypeNode", value.checkType), syntaxReads.TypeNode)
    .field("extendsType", "$TypeNode", value => syntaxReference("$TypeNode", value.extendsType), syntaxReads.TypeNode)
    .field("trueType", "$TypeNode", value => syntaxReference("$TypeNode", value.trueType), syntaxReads.TypeNode)
    .field("falseType", "$TypeNode", value => syntaxReference("$TypeNode", value.falseType), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_checkType, field_extendsType, field_trueType, field_falseType, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, checkType: field_checkType, extendsType: field_extendsType, trueType: field_trueType,
      falseType: field_falseType, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TypeOperatorNode: (value: TypeOperatorNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeOperatorNode<TypedPhase>>("TypeOperatorNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypeOperator", literalReader<(TypeOperatorNode<TypedPhase>)["kind"]>("'TypeOperator", ["TypeOperator"]))
    .field("operator", "TypeOperatorKind", value => scalarWork("TypeOperatorKind", value.operator), literalReader<(TypeOperatorNode<TypedPhase>)["operator"]>("TypeOperatorKind", ["KeyOfKeyword","ReadonlyKeyword","UniqueKeyword"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_operator, field_type, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, operator: field_operator, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_InferTypeNode: (value: InferTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<InferTypeNode<TypedPhase>>("InferTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'InferType", literalReader<(InferTypeNode<TypedPhase>)["kind"]>("'InferType", ["InferType"]))
    .field("typeParameter", "$TypeParameterDeclaration", value => syntaxReference("$TypeParameterDeclaration", value.typeParameter), syntaxReads.TypeParameterDeclaration)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameter, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, typeParameter: field_typeParameter, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ArrayTypeNode: (value: ArrayTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ArrayTypeNode<TypedPhase>>("ArrayTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ArrayType", literalReader<(ArrayTypeNode<TypedPhase>)["kind"]>("'ArrayType", ["ArrayType"]))
    .field("elementType", "$TypeNode", value => syntaxReference("$TypeNode", value.elementType), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_elementType, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, elementType: field_elementType, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_IndexedAccessTypeNode: (value: IndexedAccessTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<IndexedAccessTypeNode<TypedPhase>>("IndexedAccessTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'IndexedAccessType", literalReader<(IndexedAccessTypeNode<TypedPhase>)["kind"]>("'IndexedAccessType", ["IndexedAccessType"]))
    .field("objectType", "$TypeNode", value => syntaxReference("$TypeNode", value.objectType), syntaxReads.TypeNode)
    .field("indexType", "$TypeNode", value => syntaxReference("$TypeNode", value.indexType), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_objectType, field_indexType, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, objectType: field_objectType, indexType: field_indexType, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_TypeReferenceNode: (value: TypeReferenceNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeReferenceNode<TypedPhase>>("TypeReferenceNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypeReference", literalReader<(TypeReferenceNode<TypedPhase>)["kind"]>("'TypeReference", ["TypeReference"]))
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => work_L_TypeNode_(actual)), nullableReader(lazyReader(() => work_L_TypeNode_.reader)))
    .field("typeName", "$EntityName", value => syntaxReference("$EntityName", value.typeName), syntaxReads.EntityName)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_typeArguments, field_typeName, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, typeArguments: field_typeArguments, typeName: field_typeName, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_LiteralTypeNode: (value: LiteralTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<LiteralTypeNode<TypedPhase>>("LiteralTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'LiteralType", literalReader<(LiteralTypeNode<TypedPhase>)["kind"]>("'LiteralType", ["LiteralType"]))
    .field("literal", "$LiteralTypeChild", value => syntaxReference("$LiteralTypeChild", value.literal), syntaxReads.LiteralTypeChild)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_literal, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, literal: field_literal, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ThisTypeNode: (value: ThisTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ThisTypeNode<TypedPhase>>("ThisTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ThisType", literalReader<(ThisTypeNode<TypedPhase>)["kind"]>("'ThisType", ["ThisType"]))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_TypePredicateNode: (value: TypePredicateNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypePredicateNode<TypedPhase>>("TypePredicateNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypePredicate", literalReader<(TypePredicateNode<TypedPhase>)["kind"]>("'TypePredicate", ["TypePredicate"]))
    .field("assertsModifier", "?$AssertsKeyword", value => nullableWork(value.assertsModifier, actual => syntaxReference("$AssertsKeyword", actual)), nullableReader(syntaxReads.AssertsKeyword))
    .field("parameterName", "$TypePredicateParameterName", value => syntaxReference("$TypePredicateParameterName", value.parameterName), syntaxReads.TypePredicateParameterName)
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedPredicate", value => read.work_TypedPredicate(value.tsonic), lazyReader(() => read.work_TypedPredicate.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_assertsModifier, field_parameterName, field_type, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, assertsModifier: field_assertsModifier, parameterName: field_parameterName, type: field_type,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TypeQueryNode: (value: TypeQueryNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeQueryNode<TypedPhase>>("TypeQueryNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypeQuery", literalReader<(TypeQueryNode<TypedPhase>)["kind"]>("'TypeQuery", ["TypeQuery"]))
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => work_L_TypeNode_(actual)), nullableReader(lazyReader(() => work_L_TypeNode_.reader)))
    .field("exprName", "$EntityName", value => syntaxReference("$EntityName", value.exprName), syntaxReads.EntityName)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_typeArguments, field_exprName, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, typeArguments: field_typeArguments, exprName: field_exprName, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_MappedTypeNode: (value: MappedTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<MappedTypeNode<TypedPhase>>("MappedTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'MappedType", literalReader<(MappedTypeNode<TypedPhase>)["kind"]>("'MappedType", ["MappedType"]))
    .field("readonlyToken", "?$MappedReadonlyToken", value => nullableWork(value.readonlyToken, actual => syntaxReference("$MappedReadonlyToken", actual)), nullableReader(syntaxReads.MappedReadonlyToken))
    .field("typeParameter", "$TypeParameterDeclaration", value => syntaxReference("$TypeParameterDeclaration", value.typeParameter), syntaxReads.TypeParameterDeclaration)
    .field("nameType", "?$TypeNode", value => nullableWork(value.nameType, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("questionToken", "?$MappedQuestionToken", value => nullableWork(value.questionToken, actual => syntaxReference("$MappedQuestionToken", actual)), nullableReader(syntaxReads.MappedQuestionToken))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("members", "?L<TypeElement>", value => nullableWork(value.members, actual => work_L_TypeElement_(actual)), nullableReader(lazyReader(() => work_L_TypeElement_.reader)))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_readonlyToken, field_typeParameter, field_nameType, field_questionToken, field_type, field_members, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, readonlyToken: field_readonlyToken, typeParameter: field_typeParameter, nameType: field_nameType,
      questionToken: field_questionToken, type: field_type, members: field_members, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_TypeLiteralNode: (value: TypeLiteralNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeLiteralNode<TypedPhase>>("TypeLiteralNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypeLiteral", literalReader<(TypeLiteralNode<TypedPhase>)["kind"]>("'TypeLiteral", ["TypeLiteral"]))
    .field("members", "L<TypeElement>", value => work_L_TypeElement_(value.members), lazyReader(() => work_L_TypeElement_.reader))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_members, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, members: field_members, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_TupleTypeNode: (value: TupleTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TupleTypeNode<TypedPhase>>("TupleTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TupleType", literalReader<(TupleTypeNode<TypedPhase>)["kind"]>("'TupleType", ["TupleType"]))
    .field("elements", "L<TypeNode>", value => work_L_TypeNode_(value.elements), lazyReader(() => work_L_TypeNode_.reader))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, elements: field_elements, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_NamedTupleMember: (value: NamedTupleMember<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NamedTupleMember<TypedPhase>>("NamedTupleMember", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NamedTupleMember", literalReader<(NamedTupleMember<TypedPhase>)["kind"]>("'NamedTupleMember", ["NamedTupleMember"]))
    .field("dotDotDotToken", "?$DotDotDotToken", value => nullableWork(value.dotDotDotToken, actual => syntaxReference("$DotDotDotToken", actual)), nullableReader(syntaxReads.DotDotDotToken))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("questionToken", "?$QuestionToken", value => nullableWork(value.questionToken, actual => syntaxReference("$QuestionToken", actual)), nullableReader(syntaxReads.QuestionToken))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_dotDotDotToken, field_name, field_questionToken, field_type, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, dotDotDotToken: field_dotDotDotToken, name: field_name, questionToken: field_questionToken,
      type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_OptionalTypeNode: (value: OptionalTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<OptionalTypeNode<TypedPhase>>("OptionalTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'OptionalType", literalReader<(OptionalTypeNode<TypedPhase>)["kind"]>("'OptionalType", ["OptionalType"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_RestTypeNode: (value: RestTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<RestTypeNode<TypedPhase>>("RestTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'RestType", literalReader<(RestTypeNode<TypedPhase>)["kind"]>("'RestType", ["RestType"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ParenthesizedTypeNode: (value: ParenthesizedTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ParenthesizedTypeNode<TypedPhase>>("ParenthesizedTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ParenthesizedType", literalReader<(ParenthesizedTypeNode<TypedPhase>)["kind"]>("'ParenthesizedType", ["ParenthesizedType"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_FunctionTypeNode: (value: FunctionTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<FunctionTypeNode<TypedPhase>>("FunctionTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'FunctionType", literalReader<(FunctionTypeNode<TypedPhase>)["kind"]>("'FunctionType", ["FunctionType"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => work_L_TypeParameterDeclaration_(actual)), nullableReader(lazyReader(() => work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, typeParameters: field_typeParameters, parameters: field_parameters,
      type: field_type, fullSignature: field_fullSignature, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ConstructorTypeNode: (value: ConstructorTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ConstructorTypeNode<TypedPhase>>("ConstructorTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ConstructorType", literalReader<(ConstructorTypeNode<TypedPhase>)["kind"]>("'ConstructorType", ["ConstructorType"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => work_L_TypeParameterDeclaration_(actual)), nullableReader(lazyReader(() => work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, typeParameters: field_typeParameters, parameters: field_parameters,
      type: field_type, fullSignature: field_fullSignature, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TemplateLiteralTypeNode: (value: TemplateLiteralTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TemplateLiteralTypeNode<TypedPhase>>("TemplateLiteralTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TemplateLiteralType", literalReader<(TemplateLiteralTypeNode<TypedPhase>)["kind"]>("'TemplateLiteralType", ["TemplateLiteralType"]))
    .field("head", "$TemplateHead", value => syntaxReference("$TemplateHead", value.head), syntaxReads.TemplateHead)
    .field("templateSpans", "L<TemplateLiteralTypeSpan>", value => work_L_TemplateLiteralTypeSpan_(value.templateSpans), lazyReader(() => work_L_TemplateLiteralTypeSpan_.reader))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_head, field_templateSpans, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, head: field_head, templateSpans: field_templateSpans, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_ImportTypeNode: (value: ImportTypeNode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ImportTypeNode<TypedPhase>>("ImportTypeNode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ImportType", literalReader<(ImportTypeNode<TypedPhase>)["kind"]>("'ImportType", ["ImportType"]))
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => work_L_TypeNode_(actual)), nullableReader(lazyReader(() => work_L_TypeNode_.reader)))
    .field("isTypeOf", "boolean", value => scalarWork("boolean", value.isTypeOf), booleanReader)
    .field("argument", "$TypeNode", value => syntaxReference("$TypeNode", value.argument), syntaxReads.TypeNode)
    .field("attributes", "?$ImportAttributes", value => nullableWork(value.attributes, actual => syntaxReference("$ImportAttributes", actual)), nullableReader(syntaxReads.ImportAttributes))
    .field("qualifier", "?$EntityName", value => nullableWork(value.qualifier, actual => syntaxReference("$EntityName", actual)), nullableReader(syntaxReads.EntityName))
    .field("tsonic", "TypedType", value => read.work_TypedType(value.tsonic), lazyReader(() => read.work_TypedType.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_typeArguments, field_isTypeOf, field_argument, field_attributes, field_qualifier, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, typeArguments: field_typeArguments, isTypeOf: field_isTypeOf, argument: field_argument,
      attributes: field_attributes, qualifier: field_qualifier, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_TypeParameterDeclaration: (value: TypeParameterDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeParameterDeclaration<TypedPhase>>("TypeParameterDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TypeParameter", literalReader<(TypeParameterDeclaration<TypedPhase>)["kind"]>("'TypeParameter", ["TypeParameter"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("constraint", "?$TypeNode", value => nullableWork(value.constraint, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("expression", "?$Expression", value => nullableWork(value.expression, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("defaultType", "?$TypeNode", value => nullableWork(value.defaultType, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "TypedTypeParameter", value => read.work_TypedTypeParameter(value.tsonic), lazyReader(() => read.work_TypedTypeParameter.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_constraint, field_expression, field_defaultType, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, constraint: field_constraint,
      expression: field_expression, defaultType: field_defaultType, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_L_TypeParameterDeclaration_: TirRecordCodec<NodeList<TypeParameterDeclaration<TypedPhase>>> = defineRecord<NodeList<TypeParameterDeclaration<TypedPhase>>>("L<TypeParameterDeclaration>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$TypeParameterDeclaration]", value => sequenceWork("[$TypeParameterDeclaration]", value.nodes, actual => syntaxReference("$TypeParameterDeclaration", actual)), sequenceReader("[$TypeParameterDeclaration]", syntaxReads.TypeParameterDeclaration))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_ExpressionWithTypeArguments_: TirRecordCodec<NodeList<ExpressionWithTypeArguments<TypedPhase>>> = defineRecord<NodeList<ExpressionWithTypeArguments<TypedPhase>>>("L<ExpressionWithTypeArguments>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$ExpressionWithTypeArguments]", value => sequenceWork("[$ExpressionWithTypeArguments]", value.nodes, actual => syntaxReference("$ExpressionWithTypeArguments", actual)), sequenceReader("[$ExpressionWithTypeArguments]", syntaxReads.ExpressionWithTypeArguments))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_TypeElement_: TirRecordCodec<NodeList<TypeElement<TypedPhase>>> = defineRecord<NodeList<TypeElement<TypedPhase>>>("L<TypeElement>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$TypeElement]", value => sequenceWork("[$TypeElement]", value.nodes, actual => syntaxReference("$TypeElement", actual)), sequenceReader("[$TypeElement]", syntaxReads.TypeElement))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_TypeNode_: TirRecordCodec<NodeList<TypeNode<TypedPhase>>> = defineRecord<NodeList<TypeNode<TypedPhase>>>("L<TypeNode>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$TypeNode]", value => sequenceWork("[$TypeNode]", value.nodes, actual => syntaxReference("$TypeNode", actual)), sequenceReader("[$TypeNode]", syntaxReads.TypeNode))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_TemplateLiteralTypeSpan_: TirRecordCodec<NodeList<TemplateLiteralTypeSpan<TypedPhase>>> = defineRecord<NodeList<TemplateLiteralTypeSpan<TypedPhase>>>("L<TemplateLiteralTypeSpan>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$TemplateLiteralTypeSpan]", value => sequenceWork("[$TemplateLiteralTypeSpan]", value.nodes, actual => syntaxReference("$TemplateLiteralTypeSpan", actual)), sequenceReader("[$TemplateLiteralTypeSpan]", syntaxReads.TemplateLiteralTypeSpan))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  return { work_CallSignatureDeclaration, work_ConstructSignatureDeclaration, work_IndexSignatureDeclaration, work_MethodSignatureDeclaration, work_PropertySignatureDeclaration, work_TypeAssertion, work_KeywordTypeNode, work_UnionTypeNode, work_IntersectionTypeNode, work_ConditionalTypeNode, work_TypeOperatorNode, work_InferTypeNode, work_ArrayTypeNode, work_IndexedAccessTypeNode, work_TypeReferenceNode, work_LiteralTypeNode, work_ThisTypeNode, work_TypePredicateNode, work_TypeQueryNode, work_MappedTypeNode, work_TypeLiteralNode, work_TupleTypeNode, work_NamedTupleMember, work_OptionalTypeNode, work_RestTypeNode, work_ParenthesizedTypeNode, work_FunctionTypeNode, work_ConstructorTypeNode, work_TemplateLiteralTypeNode, work_ImportTypeNode, work_TypeParameterDeclaration, work_L_TypeParameterDeclaration_, work_L_ExpressionWithTypeArguments_, work_L_TypeElement_, work_L_TypeNode_, work_L_TemplateLiteralTypeSpan_ };
};

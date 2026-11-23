import type {
  ArrayTypeNode, ArrowFunction, AssertsKeyword, CallableSyntaxFields, ConditionalTypeNode, ConstructorTypeNode,
  DotDotDotToken, EntityName, Expression, FunctionTypeNode, Identifier, ImportAttribute, ImportAttributeName,
  IndexedAccessTypeNode, InferTypeNode, LiteralTypeChild, LiteralTypeNode, MappedTypeNode, MinusToken,
  ModifierLike, NamedTupleMember, ParameterDeclaration, Phase, PlusToken, QuestionToken, ReadonlyKeyword,
  SignatureSyntaxFields, SyntaxChildListField, SyntaxChildSlot, SyntaxCopyResult, SyntaxNode, TemplateExpression,
  TemplateHead, TemplateLiteralTypeNode, TemplateLiteralTypeSpan, TemplateMiddleOrTail, TypeElement, TypeNode,
  TypeParameterDeclaration, TypePredicateNode, TypePredicateParameterName, TypeQueryNode, TypeReferenceNode,
  TypeStructureReceipt, TypeStructureSyntax, WrappedTypeSyntax,
} from "./contract.js";
import {
  children, heldChild, heldList, heldOptionalList, prependSlots,
} from "./child-slot-storage.js";

export function isTypeStructure<P extends Phase>(node: SyntaxNode<P>): node is TypeStructureSyntax<P> {
  switch (node.kind) {
    case "TypeOperator": case "OptionalType": case "RestType": case "ParenthesizedType": case "ArrayType":
    case "JSDocTypeExpression": case "JSDocNonNullableType": case "JSDocNullableType": case "JSDocVariadicType": case "JSDocOptionalType":
    case "UnionType": case "IntersectionType": case "TupleType": case "TypeLiteral": case "ConditionalType":
    case "IndexedAccessType": case "TypeReference": case "TypeQuery": case "LiteralType": case "InferType": case "NamedTupleMember":
    case "TypePredicate": case "ImportAttribute": case "ImportAttributes": case "MappedType": case "TypeParameter":
    case "FunctionType": case "ConstructorType": case "TemplateLiteralType": case "TemplateLiteralTypeSpan":
      return true;
    default: return false;
  }
}

export function wrappedTypeSlots<P extends Phase>(type: () => TypeNode<P>) {
  return children<P, WrappedTypeSyntax<P>>(["type", "required", type]);
}

export function arrayTypeSlots<P extends Phase>(element: () => TypeNode<P>) {
  return children<P, ArrayTypeNode<P>>(["elementType", "required", element]);
}

export function conditionalTypeSlots<P extends Phase>(check: () => TypeNode<P>, bound: () => TypeNode<P>,
  whenTrue: () => TypeNode<P>, whenFalse: () => TypeNode<P>) {
  return children<P, ConditionalTypeNode<P>>(["checkType", "required", check], ["extendsType", "required", bound],
    ["trueType", "required", whenTrue], ["falseType", "required", whenFalse]);
}

export function indexedTypeSlots<P extends Phase>(object: () => TypeNode<P>, index: () => TypeNode<P>) {
  return children<P, IndexedAccessTypeNode<P>>(["objectType", "required", object], ["indexType", "required", index]);
}

export function* namedTypeSlots<P extends Phase>(field: "typeName" | "exprName", name: () => EntityName<P>,
  args: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  if (field === "typeName") yield* children<P, TypeReferenceNode<P>>([field, "required", name]);
  else yield* children<P, TypeQueryNode<P>>([field, "required", name]);
  yield* args();
}

export function literalTypeSlots<P extends Phase>(literal: () => LiteralTypeChild<P>) {
  return children<P, LiteralTypeNode<P>>(["literal", "required", literal]);
}

export function inferTypeSlots<P extends Phase>(parameter: () => TypeParameterDeclaration<P>) {
  return children<P, InferTypeNode<P>>(["typeParameter", "required", parameter]);
}

export function namedTupleSlots<P extends Phase>(dots: () => DotDotDotToken<P> | null, name: () => Identifier<P>,
  question: () => QuestionToken<P> | null, type: () => TypeNode<P>) {
  return children<P, NamedTupleMember<P>>(["dotDotDotToken", "nullable", dots], ["name", "required", name],
    ["questionToken", "nullable", question], ["type", "required", type]);
}

export function typePredicateSlots<P extends Phase>(asserts: () => AssertsKeyword<P> | null,
  name: () => TypePredicateParameterName<P>, type: () => TypeNode<P> | null) {
  return children<P, TypePredicateNode<P>>(["assertsModifier", "nullable", asserts], ["parameterName", "required", name],
    ["type", "nullable", type]);
}

export function importAttributeSlots<P extends Phase>(name: () => ImportAttributeName<P>, value: () => Expression<P>) {
  return children<P, ImportAttribute<P>>(["name", "required", name], ["value", "required", value]);
}

export function* mappedTypeSlots<P extends Phase>(readonlyToken: () => ReadonlyKeyword<P> | PlusToken<P> | MinusToken<P> | null,
  parameter: () => TypeParameterDeclaration<P>, nameType: () => TypeNode<P> | null,
  question: () => QuestionToken<P> | PlusToken<P> | MinusToken<P> | null, type: () => TypeNode<P> | null,
  members: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, MappedTypeNode<P>>(["readonlyToken", "nullable", readonlyToken], ["typeParameter", "required", parameter],
    ["nameType", "nullable", nameType], ["questionToken", "nullable", question], ["type", "nullable", type]);
  yield* members();
}

function* signatureSlots<P extends Phase>(
  typeParameters: () => Iterable<SyntaxChildSlot<P>>, parameters: () => Iterable<SyntaxChildSlot<P>>,
  type: () => TypeNode<P> | null, full: () => TypeNode<P> | null): Generator<SyntaxChildSlot<P>> {
  yield* typeParameters();
  yield* parameters();
  yield* children<P, FunctionTypeNode<P> | ConstructorTypeNode<P>>(["type", "nullable", type], ["fullSignature", "nullable", full]);
}

export function* typeParameterSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>, name: () => Identifier<P>,
  constraint: () => TypeNode<P> | null, expression: () => Expression<P> | null,
  defaultType: () => TypeNode<P> | null): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* children<P, TypeParameterDeclaration<P>>(["name", "required", name], ["constraint", "nullable", constraint],
    ["expression", "nullable", expression], ["defaultType", "nullable", defaultType]);
}

export function* templateHeadSlots<P extends Phase>(head: () => TemplateHead<P>,
  spans: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, TemplateLiteralTypeNode<P> | TemplateExpression<P>>(["head", "required", head]);
  yield* spans();
}

export function templateTypeSpanSlots<P extends Phase>(type: () => TypeNode<P>, literal: () => TemplateMiddleOrTail<P>) {
  return children<P, TemplateLiteralTypeSpan<P>>(["type", "required", type], ["literal", "required", literal]);
}

type SignatureOperands<P extends Phase> = Pick<FunctionTypeNode<P>, "typeParameters" | "parameters" | "type" | "fullSignature">;

export function rawSignatureSlots<P extends Phase>(node: SignatureOperands<P>) {
  return signatureSlots<P>(() => children<P, SignatureOperands<P>>(["typeParameters", "list", () => node.typeParameters]),
    () => children<P, SignatureOperands<P>>(["parameters", "list", () => node.parameters]), () => node.type, () => node.fullSignature);
}

export function prepareSignatureStructure<P extends Phase, Stop>(node: SignatureOperands<P>,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<SignatureSyntaxFields<P> & { readonly slots: Iterable<SyntaxChildSlot<P>> }, Stop> {
  const rawTypeParameters = node.typeParameters;
  const stop = (rawTypeParameters === null ? null : admitList("typeParameters")) ?? admitList("parameters");
  if (stop !== null) return { kind: "refused", stop };
  const typeParameters = heldOptionalList<P, TypeParameterDeclaration<P>>("typeParameters", rawTypeParameters);
  const parameters = heldList<P, ParameterDeclaration<P>>("parameters", () => node.parameters);
  const type = heldChild(() => node.type);
  const full = heldChild(() => node.fullSignature);
  return { kind: "copied", value: { slots: signatureSlots<P>(typeParameters.slots, parameters.slots, type.pull, full.pull),
    typeParameters: typeParameters.finish, parameters: parameters.finish, type: type.read, full: full.read } };
}

export function prepareCallableStructure<P extends Phase, Stop>(node: FunctionTypeNode<P> | ConstructorTypeNode<P> | ArrowFunction<P>,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<CallableSyntaxFields<P> & { readonly slots: Iterable<SyntaxChildSlot<P>> }, Stop> {
  const rawModifiers = node.modifiers;
  const modifierStop = rawModifiers === null ? null : admitList("modifiers");
  if (modifierStop !== null) return { kind: "refused", stop: modifierStop };
  const signature = prepareSignatureStructure<P, Stop>(node, admitList);
  if (signature.kind === "refused") return signature;
  const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
  return { kind: "copied", value: { ...signature.value, modifiers: modifiers.finish,
    slots: prependSlots<P>(modifiers.slots(), signature.value.slots) } };
}

export function prepareTypeStructure<P extends Phase, Stop>(node: TypeStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<TypeStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "TypeOperator": case "OptionalType": case "RestType": case "ParenthesizedType":
    case "JSDocTypeExpression": case "JSDocNonNullableType": case "JSDocNullableType": case "JSDocVariadicType": case "JSDocOptionalType": {
      const type = heldChild(() => node.type);
      return { kind: "copied", value: { kind: "type-wrapper", ordinal, slots: wrappedTypeSlots<P>(type.pull), value: type.read } };
    }
    case "ArrayType": {
      const element = heldChild(() => node.elementType);
      return { kind: "copied", value: { kind: "type-wrapper", ordinal, slots: arrayTypeSlots<P>(element.pull), value: element.read } };
    }
    case "UnionType": case "IntersectionType": {
      const stop = admitList("types");
      if (stop !== null) return { kind: "refused", stop };
      const types = heldList<P, TypeNode<P>>("types", () => node.types);
      return { kind: "copied", value: { kind: "type-vector", ordinal, slots: types.slots(), values: types.finish } };
    }
    case "TupleType": {
      const stop = admitList("elements");
      if (stop !== null) return { kind: "refused", stop };
      const elements = heldList<P, TypeNode<P>>("elements", () => node.elements);
      return { kind: "copied", value: { kind: "type-vector", ordinal, slots: elements.slots(), values: elements.finish } };
    }
    case "TypeLiteral": {
      const stop = admitList("members");
      if (stop !== null) return { kind: "refused", stop };
      const members = heldList<P, TypeElement<P>>("members", () => node.members);
      return { kind: "copied", value: { kind: "type-members", ordinal, slots: members.slots(), members: members.finish } };
    }
    case "ConditionalType": {
      const check = heldChild(() => node.checkType);
      const bound = heldChild(() => node.extendsType);
      const whenTrue = heldChild(() => node.trueType);
      const whenFalse = heldChild(() => node.falseType);
      return { kind: "copied", value: { kind: "conditional-type", ordinal,
        slots: conditionalTypeSlots<P>(check.pull, bound.pull, whenTrue.pull, whenFalse.pull),
        check: check.read, extends: bound.read, whenTrue: whenTrue.read, whenFalse: whenFalse.read } };
    }
    case "IndexedAccessType": {
      const object = heldChild(() => node.objectType);
      const index = heldChild(() => node.indexType);
      return { kind: "copied", value: { kind: "indexed-type", ordinal, slots: indexedTypeSlots<P>(object.pull, index.pull),
        object: object.read, index: index.read } };
    }
    case "TypeReference": case "TypeQuery": {
      const rawArguments = node.typeArguments;
      if (rawArguments !== null) {
        const stop = admitList("typeArguments");
        if (stop !== null) return { kind: "refused", stop };
      }
      const reference = node.kind === "TypeReference";
      const name = reference ? heldChild(() => node.typeName) : heldChild(() => node.exprName);
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      return { kind: "copied", value: { kind: "named-type", ordinal,
        slots: namedTypeSlots<P>(reference ? "typeName" : "exprName", name.pull, args.slots),
        name: name.read, arguments: args.finish } };
    }
    case "LiteralType": {
      const literal = heldChild(() => node.literal);
      return { kind: "copied", value: { kind: "literal-type", ordinal, slots: literalTypeSlots<P>(literal.pull), literal: literal.read } };
    }
    case "InferType": {
      const parameter = heldChild(() => node.typeParameter);
      return { kind: "copied", value: { kind: "infer-type", ordinal, slots: inferTypeSlots<P>(parameter.pull), parameter: parameter.read } };
    }
    case "NamedTupleMember": {
      const dots = heldChild(() => node.dotDotDotToken);
      const name = heldChild(() => node.name);
      const question = heldChild(() => node.questionToken);
      const type = heldChild(() => node.type);
      return { kind: "copied", value: { kind: "named-tuple", ordinal, slots: namedTupleSlots<P>(dots.pull, name.pull, question.pull, type.pull),
        dots: dots.read, name: name.read, question: question.read, type: type.read } };
    }
    case "TypePredicate": {
      const asserts = heldChild(() => node.assertsModifier);
      const name = heldChild(() => node.parameterName);
      const type = heldChild(() => node.type);
      return { kind: "copied", value: { kind: "type-predicate", ordinal, slots: typePredicateSlots<P>(asserts.pull, name.pull, type.pull),
        asserts: asserts.read, name: name.read, type: type.read } };
    }
    case "ImportAttribute": {
      const name = heldChild(() => node.name);
      const value = heldChild(() => node.value);
      return { kind: "copied", value: { kind: "import-attribute", ordinal, slots: importAttributeSlots<P>(name.pull, value.pull),
        name: name.read, value: value.read } };
    }
    case "ImportAttributes": {
      const stop = admitList("attributes");
      if (stop !== null) return { kind: "refused", stop };
      const attributes = heldList<P, ImportAttribute<P>>("attributes", () => node.attributes);
      return { kind: "copied", value: { kind: "import-attributes", ordinal, slots: attributes.slots(), attributes: attributes.finish } };
    }
    case "MappedType": {
      const rawMembers = node.members;
      const stop = rawMembers === null ? null : admitList("members");
      if (stop !== null) return { kind: "refused", stop };
      const readonlyToken = heldChild(() => node.readonlyToken);
      const parameter = heldChild(() => node.typeParameter);
      const nameType = heldChild(() => node.nameType);
      const question = heldChild(() => node.questionToken);
      const type = heldChild(() => node.type);
      const members = heldOptionalList<P, TypeElement<P>>("members", rawMembers);
      return { kind: "copied", value: { kind: "mapped-type", ordinal,
        slots: mappedTypeSlots<P>(readonlyToken.pull, parameter.pull, nameType.pull, question.pull, type.pull, members.slots),
        readonlyToken: readonlyToken.read, parameter: parameter.read, nameType: nameType.read, question: question.read,
        type: type.read, members: members.finish } };
    }
    case "FunctionType": case "ConstructorType": {
      const prepared = prepareCallableStructure<P, Stop>(node, admitList);
      return prepared.kind === "refused" ? prepared : { kind: "copied", value: { kind: "callable-type", ordinal, ...prepared.value } };
    }
    case "TypeParameter": {
      const rawModifiers = node.modifiers;
      const stop = rawModifiers === null ? null : admitList("modifiers");
      if (stop !== null) return { kind: "refused", stop };
      const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
      const name = heldChild(() => node.name);
      const constraint = heldChild(() => node.constraint);
      const expression = heldChild(() => node.expression);
      const defaultType = heldChild(() => node.defaultType);
      return { kind: "copied", value: { kind: "type-parameter", ordinal,
        slots: typeParameterSlots<P>(modifiers.slots, name.pull, constraint.pull, expression.pull, defaultType.pull),
        modifiers: modifiers.finish, name: name.read, constraint: constraint.read, expression: expression.read, defaultType: defaultType.read } };
    }
    case "TemplateLiteralType": {
      const stop = admitList("templateSpans");
      if (stop !== null) return { kind: "refused", stop };
      const head = heldChild(() => node.head);
      const spans = heldList<P, TemplateLiteralTypeSpan<P>>("templateSpans", () => node.templateSpans);
      return { kind: "copied", value: { kind: "template-type", ordinal, slots: templateHeadSlots<P>(head.pull, spans.slots),
        head: head.read, spans: spans.finish } };
    }
    case "TemplateLiteralTypeSpan": {
      const type = heldChild(() => node.type);
      const literal = heldChild(() => node.literal);
      return { kind: "copied", value: { kind: "template-type-span", ordinal, slots: templateTypeSpanSlots<P>(type.pull, literal.pull),
        type: type.read, literal: literal.read } };
    }
  }
}

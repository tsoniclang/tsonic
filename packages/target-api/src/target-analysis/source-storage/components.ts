import type { Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";
import { Node_Initializer } from "../../source-navigation/index.js";

export function sourcePresentStorageType(type: Type, semantics: SourceFileSemantics): Type | undefined {
  if (!semantics.types.isUnion(type)) return type;
  const present = semantics.types.unionOrIntersectionTypes(type).filter(member => !semantics.types.isNullish(member));
  return present.length === 1 ? present[0] : undefined;
}

export function sourceStorageComponentType(
  type: Type,
  component: SourceStorageProjection,
  semantics: SourceFileSemantics,
): Type | undefined {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return undefined;
  if (component.kind === "tuple-element") {
    if (!semantics.types.isTuple(selected)) return undefined;
    const elements = semantics.types.tupleElementInfos(selected);
    const element = elements[component.index];
    return element?.elementKind === "required" || element?.elementKind === "optional" ? element.type : undefined;
  }
  if (!semantics.types.isArrayLike(selected) || semantics.types.isTuple(selected) ||
    !semantics.types.isTypeReference(selected)) return undefined;
  const arguments_ = semantics.types.typeArguments(selected);
  return arguments_.length === 1 ? arguments_[0] : undefined;
}

export function* sourceStorageComponents(
  type: Type,
  semantics: SourceFileSemantics,
): Iterable<SourceStorageProjection> {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return;
  if (semantics.types.isTuple(selected)) {
    for (const [index, element] of semantics.types.tupleElementInfos(selected).entries()) {
      if (element.elementKind === "required" || element.elementKind === "optional")
        yield { kind: "tuple-element", index };
    }
  } else if (sourceStorageComponentType(selected, { kind: "array-element" }, semantics) !== undefined)
    yield { kind: "array-element" };
}

export function sourceStorageSubjectType(source: TargetSourceProgram, value: SourceStorageSubject): Type | undefined {
  const file = source.ast.getSourceFile(value.node);
  if (file === undefined || !source.semantics.includes(file)) return undefined;
  const semantics = source.semantics.forNode(value.node);
  const name = source.ast.name(value.node);
  const bindingContainer = name !== undefined && source.ast.is.IsVariableDeclaration(value.node) &&
    (source.ast.is.IsArrayBindingPattern(name) || source.ast.is.IsObjectBindingPattern(name));
  const initializer = bindingContainer ? Node_Initializer(source.ast, value.node) : undefined;
  const allocationLiteral = source.ast.is.IsObjectLiteralExpression(value.node) || source.ast.is.IsArrayLiteralExpression(value.node);
  const nodeType = bindingContainer ? initializer === undefined ? undefined : semantics.types.expressionType(initializer)
    : allocationLiteral ? semantics.types.expressionType(value.node)
      : semantics.declarations.declaredValueType(value.node) ?? semantics.types.expressionType(value.node);
  const signatures = value.kind !== "return" || nodeType === undefined ? [] : semantics.types.callSignatures(nodeType)
    .filter(signature => semantics.declarations.signatureDeclaration(signature) === value.node);
  let selected = value.kind === "return" ? signatures.length === 1 ? semantics.types.returnType(signatures[0]!) : undefined
    : value.kind === "receiver" ? semantics.declarations.declaredType(value.node) : nodeType;
  for (const component of value.projection) {
    if (selected === undefined) return undefined;
    selected = sourceStorageComponentType(selected, component, semantics);
  }
  return selected;
}

export function sourceIndexedStorageProjection(
  type: Type,
  index: Node | undefined,
  semantics: SourceFileSemantics,
): SourceStorageProjection | undefined {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return undefined;
  if (semantics.types.isTuple(selected)) {
    const indexType = index === undefined ? undefined : semantics.types.expressionType(index);
    const value = indexType === undefined ? undefined : semantics.types.numericLiteralValue(indexType);
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 &&
      sourceStorageComponentType(selected, { kind: "tuple-element", index: value }, semantics) !== undefined
      ? Object.freeze({ kind: "tuple-element", index: value }) : undefined;
  }
  return sourceStorageComponentType(selected, { kind: "array-element" }, semantics) === undefined
    ? undefined : Object.freeze({ kind: "array-element" });
}

import { providerVirtualDeclarationFactKey, sourceMarkerFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ProviderTypeExpression, SourcePrimitiveKind } from "@tsonic/tsts";
import {
  selectSourceProviderSignature, sourceTypeDescriptorArms, sourceTypeDescriptorStructure, sourceAnalysisValueType, type HostSourceProgram,
} from "@tsonic/target-api/host";
import type { SourceProviderTypeParameterSelection, SourceTypeDescriptor } from "@tsonic/target-api/source";
import { tsonicCoreProviderVersion, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";

const coreTypeMarkers = tsonicCoreSourceSemanticsModules().flatMap(module =>
  module.exports.flatMap(declaration => declaration.kind === "type-marker"
    ? [{ module: module.moduleSpecifier, declaration }] : []));

export type TsonicProviderPointerResult<Carrier> =
  | { readonly kind: "resolved"; readonly carrier: Carrier }
  | { readonly kind: "invalid"; readonly reason: string };

/** Carrier-neutral shape of a provider pointer result, published by the Host (checker-free, I1). */
export type TsonicProviderPointerShape =
  | { readonly kind: "primitive"; readonly primitive: SourcePrimitiveKind }
  | { readonly kind: "pointer"; readonly pointee: TsonicProviderPointerShape }
  | { readonly kind: "raw" }
  | { readonly kind: "optional"; readonly value: TsonicProviderPointerShape }
  | { readonly kind: "array"; readonly element: TsonicProviderPointerShape }
  | { readonly kind: "tuple"; readonly elements: readonly TsonicProviderPointerShape[] }
  | { readonly kind: "type-parameter"; readonly parameter: SourceProviderTypeParameterSelection }
  /** An authored Source type position, with its Host descriptor. */
  | { readonly kind: "source"; readonly syntax: Node; readonly type: SourceTypeDescriptor };

export type TsonicProviderPointerSelection = TsonicProviderPointerResult<TsonicProviderPointerShape>;

export interface TsonicProviderPointerCarrierPolicy<Carrier> {
  readonly primitive: (kind: SourcePrimitiveKind) => Carrier | undefined;
  readonly pointer: (pointee: Carrier) => Carrier | undefined;
  readonly raw: () => Carrier | undefined;
  readonly optional: (value: Carrier) => Carrier | undefined;
  readonly array: (element: Carrier) => Carrier | undefined;
  readonly tuple: (elements: readonly Carrier[]) => Carrier | undefined;
  readonly typeParameter: (parameter: SourceProviderTypeParameterSelection) => Carrier | undefined;
  readonly sourceType: (type: SourceTypeDescriptor, syntax: Node) => Carrier | undefined;
}

/** Target-side fold of a published pointer shape into the target carrier (program-free). */
export function foldTsonicProviderPointerResult<Carrier>(
  selected: TsonicProviderPointerSelection | undefined,
  policy: TsonicProviderPointerCarrierPolicy<Carrier>,
): TsonicProviderPointerResult<Carrier> | undefined {
  if (selected === undefined || selected.kind === "invalid") return selected;
  const fold = (shape: TsonicProviderPointerShape): Carrier | undefined => {
    switch (shape.kind) {
      case "primitive": return policy.primitive(shape.primitive);
      case "raw": return policy.raw();
      case "type-parameter": return policy.typeParameter(shape.parameter);
      case "source": return policy.sourceType(shape.type, shape.syntax);
      case "pointer": { const pointee = fold(shape.pointee); return pointee === undefined ? undefined : policy.pointer(pointee); }
      case "optional": { const value = fold(shape.value); return value === undefined ? undefined : policy.optional(value); }
      case "array": { const element = fold(shape.element); return element === undefined ? undefined : policy.array(element); }
      case "tuple": {
        const elements = shape.elements.map(fold);
        return elements.every((value): value is Carrier => value !== undefined) ? policy.tuple(elements) : undefined;
      }
    }
  };
  const carrier = fold(selected.carrier);
  return carrier === undefined
    ? { kind: "invalid", reason: "The selected provider pointer result has no closed canonical target carrier." }
    : { kind: "resolved", carrier };
}

/** Host: the pointer result shape of a provider call (undefined when the call has no pointer result). */
export function selectTsonicProviderPointerShape(host: HostSourceProgram, call: Node): TsonicProviderPointerSelection | undefined {
  const { ast, sourceFacts: facts, navigation } = host;
  // The selected signature declaration (navigation call witness) and its authored result annotation.
  const signature = navigation.call(call)?.signature;
  if (signature === undefined) return undefined;
  const authoredResult = ast.typeNode(signature);
  type Carrier = TsonicProviderPointerShape;
  const policy = {
    primitive: (primitive: SourcePrimitiveKind): Carrier => Object.freeze({ kind: "primitive", primitive }),
    pointer: (pointee: Carrier): Carrier => Object.freeze({ kind: "pointer", pointee }),
    raw: (): Carrier => Object.freeze({ kind: "raw" }),
    optional: (value: Carrier): Carrier => Object.freeze({ kind: "optional", value }),
    array: (element: Carrier): Carrier => Object.freeze({ kind: "array", element }),
    tuple: (elements: readonly Carrier[]): Carrier => Object.freeze({ kind: "tuple", elements: Object.freeze([...elements]) }),
    typeParameter: (parameter: SourceProviderTypeParameterSelection): Carrier => Object.freeze({ kind: "type-parameter", parameter }),
    sourceType: (syntax: Node): Carrier | undefined => {
      const outcome = host.facts.values.type(syntax);
      return outcome.kind === "refused" ? undefined : Object.freeze({ kind: "source", syntax, type: outcome.type });
    },
  };
  if (authoredResult === undefined) return undefined;
  const invalid = (reason: string): TsonicProviderPointerResult<Carrier> => ({ kind: "invalid", reason });
  let identityConflict = false;
  const unwrap = (node: Node): Node => {
    while (ast.is.IsParenthesizedTypeNode(node)) {
      const inner = ast.typeNode(node);
      if (inner === undefined) break;
      node = inner;
    }
    return node;
  };
  const markerForSubjects = (subjects: readonly ExtensionFactSubject[]): string | undefined => {
    const markers = new Set<string>();
    for (const subject of subjects) {
      const marker = facts.getFact(subject, sourceMarkerFactKey);
      if (marker?.kind === "type-marker") markers.add(marker.marker);
      const identity = facts.getFact(subject, providerVirtualDeclarationFactKey);
      if (identity?.providerId !== tsonicCoreVirtualModulesProviderId) continue;
      const declared = coreTypeMarkers.find(value => value.module === identity.providerModuleId &&
        value.declaration.exportName === identity.exportId);
      if (declared === undefined) continue;
      if (identity.providerVersion !== tsonicCoreProviderVersion ||
          identity.moduleSpecifier !== declared.module ||
          identity.exportName !== declared.declaration.exportName ||
          identity.memberId !== undefined || identity.signatureId !== undefined) {
        identityConflict = true;
      }
      markers.add(declared.declaration.marker);
    }
    if (markers.size > 1) identityConflict = true;
    return markers.size === 1 ? markers.values().next().value : undefined;
  };
  // The marker subjects of an authored type position: the node and the declarations its type reference selects.
  const declarationSubjects = (declaration: Node | undefined): readonly Node[] =>
    declaration === undefined ? [] : navigation.mergedDeclarations(declaration);
  const markerFor = (node: Node): string | undefined => {
    const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName : undefined;
    return markerForSubjects([node, ...declarationSubjects(name === undefined ? undefined : navigation.declarationFor(name))]);
  };
  const isPointer = (node: Node): boolean => {
    node = unwrap(node);
    const marker = markerFor(node);
    return marker === "pointer" || marker === "raw-pointer" ||
      (ast.is.IsUnionTypeNode(node) && ast.children(node).some(child => child !== undefined && isPointer(child)));
  };
  // The Host result of the call: an arm whose declared structure names a pointer marker declaration.
  const result = sourceAnalysisValueType(host, call);
  const selectedPointer = result !== undefined && sourceTypeDescriptorArms(result).some(arm => {
    const type = sourceTypeDescriptorStructure(arm);
    if (type.kind !== "declared") return false;
    const marker = markerForSubjects(declarationSubjects(type.declaration));
    return marker === "pointer" || marker === "raw-pointer";
  });
  const pointerResult = isPointer(authoredResult) || selectedPointer;
  if (identityConflict) return invalid("The selected provider result has contradictory source marker identities.");
  if (!pointerResult) return undefined;
  const provider = selectSourceProviderSignature(facts, signature);
  if (provider === undefined || provider.kind === "invalid") {
    return invalid(provider?.reason ?? "The pointer result has no exact retained provider signature.");
  }
  const resolve = (model: ProviderTypeExpression, input: Node, depth: number): Carrier | undefined => {
    if (depth > 128) return undefined;
    const node = unwrap(input);
    if (model.kind === "source-primitive") return policy.primitive(model.name);
    if (model.kind === "type-parameter") {
      const parameter = provider.typeParameters.find(value => value.parameter.name === model.name);
      return parameter === undefined ? undefined : policy.typeParameter(parameter);
    }
    if (model.kind === "provider-ref") {
      const marker = markerFor(node);
      if (marker === "raw-pointer") return policy.raw();
      if (marker === "pointer") {
        const argumentsList = ast.typeArguments(node);
        const pointeeModel = model.typeArguments?.[0];
        if (argumentsList?.length !== 1 || model.typeArguments?.length !== 1 ||
            argumentsList[0] === undefined || pointeeModel === undefined) return undefined;
        const pointee = resolve(pointeeModel, argumentsList[0], depth + 1);
        return pointee === undefined ? undefined : policy.pointer(pointee);
      }
    }
    if (model.kind === "array") {
      const elementNode = ast.as.AsArrayTypeNode(node)?.ElementType;
      const element = elementNode === undefined ? undefined : resolve(model.elementType, elementNode, depth + 1);
      return element === undefined ? undefined : policy.array(element);
    }
    if (model.kind === "tuple") {
      const elements = ast.elements(node);
      if (elements.length !== model.elementTypes.length) return undefined;
      const carriers = model.elementTypes.map((value, index) => {
        const element = elements[index];
        return element === undefined ? undefined : resolve(value, element, depth + 1);
      });
      return carriers.every((value): value is Carrier => value !== undefined) ? policy.tuple(carriers) : undefined;
    }
    if (model.kind === "union") {
      const children = ast.children(node).filter((child): child is Node => child !== undefined);
      if (children.length !== model.types.length) return undefined;
      const values = model.types.flatMap((value, index) => value.kind === "undefined" ||
        (value.kind === "literal" && value.value === null) ? [] : [{ value, node: children[index]! }]);
      if (values.length !== 1 || values.length === model.types.length) return undefined;
      const value = values[0];
      if (value?.value === undefined) return undefined;
      const carrier = resolve(value.value, value.node, depth + 1);
      return carrier === undefined ? undefined : policy.optional(carrier);
    }
    return policy.sourceType(node);
  };
  const carrier = provider.signature.returnType === undefined ? undefined :
    resolve(provider.signature.returnType, authoredResult, 0);
  if (identityConflict) return invalid("The selected provider result has contradictory source marker identities.");
  return carrier === undefined
    ? invalid("The selected provider pointer result has no closed canonical source carrier.")
    : { kind: "resolved", carrier };
}

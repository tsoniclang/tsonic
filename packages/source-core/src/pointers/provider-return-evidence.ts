import { providerVirtualDeclarationFactKey, sourceMarkerFactKey } from "@tsonic/tsts";
import type { AstReader, ExtensionFactSubject, Node, ProviderTypeExpression, ReadonlySourceFactResolver, SourcePrimitiveKind, Type } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo, SourceFileSemantics, SourceProviderTypeParameterSelection } from "@tsonic/target-api/source";
import { tsonicCoreProviderVersion, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";

const coreTypeMarkers = tsonicCoreSourceSemanticsModules().flatMap(module =>
  module.exports.flatMap(declaration => declaration.kind === "type-marker"
    ? [{ module: module.moduleSpecifier, declaration }] : []));

export type TsonicProviderPointerResult<Carrier> =
  | { readonly kind: "resolved"; readonly carrier: Carrier }
  | { readonly kind: "invalid"; readonly reason: string };

export interface TsonicProviderPointerCarrierPolicy<Carrier> {
  readonly primitive: (kind: SourcePrimitiveKind) => Carrier | undefined;
  readonly pointer: (pointee: Carrier) => Carrier | undefined;
  readonly raw: () => Carrier | undefined;
  readonly optional: (value: Carrier) => Carrier | undefined;
  readonly array: (element: Carrier) => Carrier | undefined;
  readonly tuple: (elements: readonly Carrier[]) => Carrier | undefined;
  readonly typeParameter: (parameter: SourceProviderTypeParameterSelection) => Carrier | undefined;
  readonly sourceType: (type: Type, syntax: Node | undefined) => Carrier | undefined;
}

export function selectTsonicProviderPointerResult<Carrier>(
  source: ResolvedSourceCallInfo,
  ast: AstReader,
  semantics: SourceFileSemantics,
  facts: ReadonlySourceFactResolver,
  policy: TsonicProviderPointerCarrierPolicy<Carrier>,
): TsonicProviderPointerResult<Carrier> | undefined {
  const selected = semantics.operations.callResult(source);
  if (selected?.authoredTypeNode === undefined) return undefined;
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
  const markerFor = (node: Node): string | undefined => {
    const type = semantics.types.authoredType(node);
    return markerForSubjects(type === undefined ? [node] : [node, ...semantics.facts.typeSubjects(type)]);
  };
  const isPointer = (node: Node): boolean => {
    node = unwrap(node);
    const marker = markerFor(node);
    return marker === "pointer" || marker === "raw-pointer" ||
      (ast.is.IsUnionTypeNode(node) && ast.children(node).some(child => child !== undefined && isPointer(child)));
  };
  const resultTypes = semantics.types.isUnion(selected.resultType)
    ? semantics.types.unionOrIntersectionTypes(selected.resultType) : [selected.resultType];
  const selectedPointer = resultTypes.some(type => {
    const marker = markerForSubjects(semantics.facts.typeSubjects(type));
    return marker === "pointer" || marker === "raw-pointer";
  });
  const pointerResult = isPointer(selected.authoredTypeNode) || selectedPointer;
  if (identityConflict) return invalid("The selected provider result has contradictory source marker identities.");
  if (!pointerResult) return undefined;
  const provider = selected.providerSignature;
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
    const type = semantics.types.authoredType(node);
    return type === undefined ? undefined : policy.sourceType(type, node);
  };
  const carrier = provider.signature.returnType === undefined ? undefined :
    resolve(provider.signature.returnType, selected.authoredTypeNode, 0);
  if (identityConflict) return invalid("The selected provider result has contradictory source marker identities.");
  return carrier === undefined
    ? invalid("The selected provider pointer result has no closed canonical source carrier.")
    : { kind: "resolved", carrier };
}

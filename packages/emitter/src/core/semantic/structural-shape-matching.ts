/**
 * Structural shape matching and structural-to-nominal type resolution.
 *
 * Extracted from structural-resolution.ts — contains structural shape
 * comparison logic and the normalizeStructuralEmissionType deep walker.
 */

import type {
  IrType,
  IrPropertyDeclaration,
  TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import { stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { LocalTypeInfo } from "../../emitter-types/core.js";
import { resolveTypeAlias, stripNullish } from "./nullish-value-helpers.js";
import {
  resolveLocalTypeInfoWithoutBindings,
  resolveBindingBackedReferenceType,
} from "./property-member-lookup.js";

type StructuralShapeMember = {
  readonly name: string;
  readonly isOptional: boolean;
  readonly typeKey: string;
};

const sortStructuralShape = (
  members: readonly StructuralShapeMember[]
): readonly StructuralShapeMember[] =>
  [...members].sort((left, right) => left.name.localeCompare(right.name));

const stripUndefinedFromStructuralShapeType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const remaining = type.types.filter(
    (member) =>
      !(member.kind === "primitiveType" && member.name === "undefined")
  );

  if (remaining.length === 1 && remaining[0]) {
    return remaining[0];
  }

  return remaining.length === type.types.length
    ? type
    : {
        kind: "unionType",
        types: remaining,
      };
};

const hasUndefinedStructuralOptionality = (type: IrType): boolean =>
  type.kind === "unionType" &&
  type.types.some(
    (member) => member.kind === "primitiveType" && member.name === "undefined"
  );

const structuralShapesEqual = (
  left: readonly StructuralShapeMember[],
  right: readonly StructuralShapeMember[]
): boolean =>
  left.length === right.length &&
  left.every(
    (member, index) =>
      member.name === right[index]?.name &&
      member.isOptional === right[index]?.isOptional &&
      member.typeKey === right[index]?.typeKey
  );

const getObjectTypeStructuralShape = (
  type: Extract<IrType, { kind: "objectType" }>
): readonly StructuralShapeMember[] | undefined => {
  if (type.members.some((member) => member.kind === "methodSignature")) {
    return undefined;
  }

  return sortStructuralShape(
    type.members
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        isOptional: member.isOptional,
        typeKey: stableIrTypeKey(member.type),
      }))
  );
};

const getLocalTypeInfoStructuralShape = (
  info: LocalTypeInfo,
  context: EmitterContext
): readonly StructuralShapeMember[] | undefined => {
  switch (info.kind) {
    case "typeAlias": {
      const resolved = resolveTypeAlias(info.type, context);
      if (resolved.kind !== "objectType") {
        return undefined;
      }
      return getObjectTypeStructuralShape(resolved);
    }

    case "interface": {
      if (info.members.some((member) => member.kind === "methodSignature")) {
        return undefined;
      }
      return sortStructuralShape(
        info.members
          .filter(
            (
              member
            ): member is Extract<
              typeof member,
              { kind: "propertySignature" }
            > => member.kind === "propertySignature"
          )
          .map((member) => ({
            name: member.name,
            isOptional: member.isOptional,
            typeKey: stableIrTypeKey(member.type),
          }))
      );
    }

    case "class": {
      if (info.members.some((member) => member.kind === "methodDeclaration")) {
        return undefined;
      }

      const propertyMembers = info.members.filter(
        (member): member is IrPropertyDeclaration & { type: IrType } =>
          member.kind === "propertyDeclaration" && member.type !== undefined
      );

      return sortStructuralShape(
        propertyMembers.map((member) => {
          const isOptional = hasUndefinedStructuralOptionality(member.type);
          return {
            name: member.name,
            isOptional,
            typeKey: stableIrTypeKey(
              isOptional
                ? stripUndefinedFromStructuralShapeType(member.type)
                : member.type
            ),
          };
        })
      );
    }

    case "enum":
      return undefined;
  }
};

const getBindingStructuralShape = (
  binding: FrontendTypeBinding
): readonly StructuralShapeMember[] | undefined => {
  if (binding.kind === "enum") {
    return undefined;
  }

  if (binding.members.some((member) => member.kind === "method")) {
    return undefined;
  }

  const propertyMembers = binding.members.filter(
    (
      member
    ): member is (typeof binding.members)[number] & {
      kind: "property";
      semanticType: IrType;
    } => member.kind === "property" && member.semanticType !== undefined
  );

  if (propertyMembers.length !== binding.members.length) {
    return undefined;
  }

  return sortStructuralShape(
    propertyMembers.map((member) => ({
      name: member.alias,
      isOptional: member.semanticOptional === true,
      typeKey: stableIrTypeKey(
        member.semanticOptional === true
          ? stripUndefinedFromStructuralShapeType(member.semanticType)
          : member.semanticType
      ),
    }))
  );
};

type StructuralReferenceCandidate = {
  readonly dedupeKey: string;
  readonly isCurrentLocal: boolean;
  readonly isCurrentNamespace: boolean;
  readonly isCompilerGenerated: boolean;
  readonly ref: Extract<IrType, { kind: "referenceType" }>;
};

const isCompilerGeneratedStructuralName = (
  name: string | undefined
): boolean => !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

export const isCompilerGeneratedStructuralReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>
): boolean => {
  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrSimpleName = type.resolvedClrType?.split(".").pop();
  return (
    isCompilerGeneratedStructuralName(simpleName) ||
    isCompilerGeneratedStructuralName(clrSimpleName)
  );
};

const isStructurallyEmittedLocalTypeInfo = (
  info: LocalTypeInfo | undefined
): boolean => {
  if (!info) {
    return false;
  }

  switch (info.kind) {
    case "typeAlias":
      return info.type.kind === "objectType";
    case "interface":
      return true;
    case "class":
      return info.members.every(
        (member) => member.kind !== "methodDeclaration"
      );
    case "enum":
      return false;
  }
};

const sanitizeTypeArguments = (
  typeArguments: readonly IrType[] | undefined
): readonly IrType[] | undefined => {
  if (!typeArguments || typeArguments.length === 0) {
    return undefined;
  }

  const filtered = typeArguments.filter(
    (typeArgument): typeArgument is IrType => typeArgument !== undefined
  );
  return filtered.length > 0 ? filtered : undefined;
};

const buildReferenceType = (
  name: string,
  resolvedClrType: string | undefined,
  typeArguments: readonly IrType[] | undefined
): Extract<IrType, { kind: "referenceType" }> => ({
  kind: "referenceType",
  name,
  ...(resolvedClrType ? { resolvedClrType } : {}),
  ...(typeArguments ? { typeArguments: [...typeArguments] } : {}),
});

type IteratorResultVariant = {
  readonly done: boolean;
  readonly valueType: IrType;
};

const tryResolveIteratorResultVariant = (
  type: IrType,
  context: EmitterContext
): IteratorResultVariant | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  const members =
    resolved.kind === "objectType"
      ? resolved.members
      : resolved.kind === "referenceType"
        ? resolved.structuralMembers
        : undefined;
  if (!members || members.length !== 2) {
    return undefined;
  }

  const properties = members.filter(
    (
      member
    ): member is Extract<typeof member, { kind: "propertySignature" }> =>
      member.kind === "propertySignature"
  );
  if (properties.length !== 2) {
    return undefined;
  }

  const doneProperty = properties.find((member) => member.name === "done");
  const valueProperty = properties.find((member) => member.name === "value");
  if (
    !doneProperty ||
    !valueProperty ||
    doneProperty.isOptional ||
    valueProperty.isOptional
  ) {
    return undefined;
  }

  if (
    doneProperty.type.kind !== "literalType" ||
    typeof doneProperty.type.value !== "boolean"
  ) {
    return undefined;
  }

  return {
    done: doneProperty.type.value,
    valueType: valueProperty.type,
  };
};

export const resolveIteratorResultReferenceType = (
  type: IrType,
  context: EmitterContext
): Extract<IrType, { kind: "referenceType" }> | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "unionType" || resolved.types.length !== 2) {
    return undefined;
  }

  const variants = resolved.types
    .map((member) => tryResolveIteratorResultVariant(member, context))
    .filter((variant): variant is IteratorResultVariant => variant !== undefined);
  if (variants.length !== 2) {
    return undefined;
  }

  const doneFalseVariant = variants.find((variant) => variant.done === false);
  const doneTrueVariant = variants.find((variant) => variant.done === true);
  if (!doneFalseVariant || !doneTrueVariant) {
    return undefined;
  }

  return buildReferenceType(
    "IteratorResult",
    "global::Tsonic.Runtime.IteratorResult",
    [doneFalseVariant.valueType]
  );
};

/**
 * Resolve an inline/object structural type to a canonical emitted nominal reference
 * when the current compilation already declares an equivalent structural type.
 *
 * This is used in emitter-side contextual type paths that must emit a CLR type name
 * (for example array-wrapper element types or nominal object construction),
 * but sometimes receive an objectType after alias resolution. When we can prove that
 * object shape matches an existing structural alias/interface/class, we preserve the
 * canonical emitted reference instead of letting raw objectType reach type emission.
 */
export const resolveStructuralReferenceType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const stripped = stripNullish(type);
  const iteratorResultReference = resolveIteratorResultReferenceType(
    stripped,
    context
  );
  if (iteratorResultReference) {
    return iteratorResultReference;
  }
  const preserveCompilerGeneratedReference =
    stripped.kind === "referenceType" &&
    isCompilerGeneratedStructuralReferenceType(stripped);
  let targetShape: readonly StructuralShapeMember[] | undefined;
  let preservedTypeArguments: readonly IrType[] | undefined;

  if (stripped.kind === "referenceType") {
    preservedTypeArguments = sanitizeTypeArguments(stripped.typeArguments);
    const directLocalType = resolveLocalTypeInfoWithoutBindings(
      stripped,
      context
    )?.info;
    if (isStructurallyEmittedLocalTypeInfo(directLocalType)) {
      const directShape = getLocalTypeInfoStructuralShape(
        directLocalType!,
        context
      );
      targetShape = directShape;
      if (!isCompilerGeneratedStructuralReferenceType(stripped)) {
        return stripped;
      }
    }

    const rebound = resolveBindingBackedReferenceType(stripped, context);
    preservedTypeArguments ??= sanitizeTypeArguments(rebound?.typeArguments);
    const reboundLocalType = rebound
      ? resolveLocalTypeInfoWithoutBindings(rebound, context)?.info
      : undefined;
    if (rebound && isStructurallyEmittedLocalTypeInfo(reboundLocalType)) {
      const reboundShape = getLocalTypeInfoStructuralShape(
        reboundLocalType!,
        context
      );
      targetShape ??= reboundShape;
      if (!isCompilerGeneratedStructuralReferenceType(rebound)) {
        return rebound;
      }
    }
  }

  if (!targetShape) {
    const resolved = resolveTypeAlias(stripped, context);
    if (resolved.kind !== "objectType") {
      return undefined;
    }

    targetShape = getObjectTypeStructuralShape(resolved);
    if (!targetShape || targetShape.length === 0) {
      return undefined;
    }
  }

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const candidates: StructuralReferenceCandidate[] = [];
  const seenKeys = new Set<string>();

  const pushCandidate = (
    typeName: string,
    namespace: string,
    info: LocalTypeInfo,
    isCurrentLocal: boolean
  ): void => {
    const shape = getLocalTypeInfoStructuralShape(info, context);
    if (!shape || !structuralShapesEqual(shape, targetShape)) {
      return;
    }

    const emittedName =
      info.kind === "typeAlias" ? `${typeName}__Alias` : typeName;
    const resolvedClrType =
      isCurrentLocal && namespace === currentNamespace
        ? undefined
        : `${namespace}.${emittedName}`;
    const dedupeKey = resolvedClrType ?? `${namespace}.${emittedName}`;
    if (seenKeys.has(dedupeKey)) {
      return;
    }
    seenKeys.add(dedupeKey);

    candidates.push({
      dedupeKey,
      isCurrentLocal,
      isCurrentNamespace: namespace === currentNamespace,
      isCompilerGenerated:
        isCompilerGeneratedStructuralName(typeName) ||
        isCompilerGeneratedStructuralName(emittedName),
      ref: buildReferenceType(
        typeName,
        resolvedClrType,
        info.kind !== "enum" &&
          preservedTypeArguments &&
          preservedTypeArguments.length === info.typeParameters.length
          ? preservedTypeArguments
          : undefined
      ),
    });
  };

  if (context.localTypes) {
    for (const [typeName, info] of context.localTypes.entries()) {
      pushCandidate(typeName, currentNamespace, info, true);
    }
  }

  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (!module.localTypes) continue;
      for (const [typeName, info] of module.localTypes.entries()) {
        pushCandidate(typeName, module.namespace, info, false);
      }
    }
  }

  const aliasIndex = context.options.typeAliasIndex;
  if (aliasIndex) {
    for (const entry of aliasIndex.byFqn.values()) {
      const aliasShape =
        entry.type.kind === "objectType"
          ? getObjectTypeStructuralShape(entry.type)
          : undefined;
      if (!aliasShape || !structuralShapesEqual(aliasShape, targetShape)) {
        continue;
      }

      const lastDot = entry.fqn.lastIndexOf(".");
      const namespace =
        lastDot === -1 ? currentNamespace : entry.fqn.slice(0, lastDot);
      const emittedName = `${entry.name}__Alias`;
      const resolvedClrType =
        namespace === currentNamespace
          ? undefined
          : `${namespace}.${emittedName}`;
      const dedupeKey = resolvedClrType ?? `${namespace}.${emittedName}`;
      if (seenKeys.has(dedupeKey)) {
        continue;
      }
      seenKeys.add(dedupeKey);

      candidates.push({
        dedupeKey,
        isCurrentLocal: namespace === currentNamespace,
        isCurrentNamespace: namespace === currentNamespace,
        isCompilerGenerated:
          isCompilerGeneratedStructuralName(entry.name) ||
          isCompilerGeneratedStructuralName(emittedName),
        ref: buildReferenceType(entry.name, resolvedClrType, undefined),
      });
    }
  }

  const registry = context.bindingsRegistry;
  if (registry) {
    for (const binding of registry.values()) {
      const bindingShape = getBindingStructuralShape(binding);
      if (!bindingShape || !structuralShapesEqual(bindingShape, targetShape)) {
        continue;
      }

      const resolvedClrType = binding.name;
      const lastDot = resolvedClrType.lastIndexOf(".");
      const namespace =
        lastDot === -1 ? currentNamespace : resolvedClrType.slice(0, lastDot);
      const typeName = binding.alias.split(".").pop() ?? binding.alias;
      const dedupeKey = resolvedClrType;
      if (seenKeys.has(dedupeKey)) {
        continue;
      }
      seenKeys.add(dedupeKey);

      candidates.push({
        dedupeKey,
        isCurrentLocal: false,
        isCurrentNamespace: namespace === currentNamespace,
        isCompilerGenerated:
          isCompilerGeneratedStructuralName(typeName) ||
          isCompilerGeneratedStructuralName(
            resolvedClrType.split(".").pop() ?? resolvedClrType
          ),
        ref: buildReferenceType(typeName, resolvedClrType, preservedTypeArguments),
      });
    }
  }

  const selectCandidate = (
    options: readonly StructuralReferenceCandidate[]
  ): IrType | undefined => {
    const explicit = options.filter((candidate) => !candidate.isCompilerGenerated);
    if (explicit.length === 1) {
      return explicit[0]?.ref;
    }
    if (explicit.length > 1) {
      return undefined;
    }
    return options.length === 1 ? options[0]?.ref : undefined;
  };

  const currentLocalMatches = candidates.filter(
    (candidate) => candidate.isCurrentLocal
  );
  const currentLocalSelection = selectCandidate(currentLocalMatches);
  if (currentLocalSelection) {
    return currentLocalSelection;
  }
  if (currentLocalMatches.length > 1) {
    return undefined;
  }
  if (preserveCompilerGeneratedReference) {
    return stripped;
  }

  const currentNamespaceMatches = candidates.filter(
    (candidate) => candidate.isCurrentNamespace
  );
  const currentNamespaceSelection = selectCandidate(currentNamespaceMatches);
  if (currentNamespaceSelection) {
    return currentNamespaceSelection;
  }
  if (currentNamespaceMatches.length > 1) {
    return undefined;
  }

  return selectCandidate(candidates);
};

export const normalizeStructuralEmissionType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const cache = new Map<IrType, IrType>();
  const active = new Set<IrType>();

  const normalize = (current: IrType): IrType => {
    const rebound = resolveStructuralReferenceType(current, context);
    if (rebound) {
      return rebound;
    }

    if (active.has(current)) {
      return current;
    }

    const cached = cache.get(current);
    if (cached) {
      return cached;
    }

    active.add(current);

    const normalized = (() => {
      switch (current.kind) {
        case "referenceType": {
          const typeArguments = current.typeArguments?.map(normalize);
          const hasChanged =
            !!typeArguments &&
            typeArguments.some(
              (argument, index) => argument !== current.typeArguments?.[index]
            );
          return hasChanged
            ? {
                ...current,
                typeArguments,
              }
            : current;
        }
        case "arrayType": {
          const elementType = normalize(current.elementType);
          const tuplePrefixElementTypes =
            current.tuplePrefixElementTypes?.map(normalize);
          const tupleRestElementType = current.tupleRestElementType
            ? normalize(current.tupleRestElementType)
            : undefined;
          const hasChanged =
            elementType !== current.elementType ||
            (!!tuplePrefixElementTypes &&
              tuplePrefixElementTypes.some(
                (element, index) =>
                  element !== current.tuplePrefixElementTypes?.[index]
              )) ||
            tupleRestElementType !== current.tupleRestElementType;
          return hasChanged
            ? {
                ...current,
                elementType,
                ...(tuplePrefixElementTypes ? { tuplePrefixElementTypes } : {}),
                ...(tupleRestElementType ? { tupleRestElementType } : {}),
              }
            : current;
        }
        case "tupleType": {
          const elementTypes = current.elementTypes.map(normalize);
          return elementTypes.some(
            (element, index) => element !== current.elementTypes[index]
          )
            ? { ...current, elementTypes }
            : current;
        }
        case "functionType": {
          const parameters = current.parameters.map((parameter) =>
            parameter.type
              ? {
                  ...parameter,
                  type: normalize(parameter.type),
                }
              : parameter
          );
          const returnType = normalize(current.returnType);
          const hasChanged =
            returnType !== current.returnType ||
            parameters.some(
              (parameter, index) => parameter !== current.parameters[index]
            );
          return hasChanged
            ? {
                ...current,
                parameters,
                returnType,
              }
            : current;
        }
        case "objectType": {
          const members = current.members.map((member) => {
            switch (member.kind) {
              case "propertySignature": {
                const memberType = normalize(member.type);
                return memberType !== member.type
                  ? {
                      ...member,
                      type: memberType,
                    }
                  : member;
              }
              case "methodSignature": {
                const parameters = member.parameters.map((parameter) =>
                  parameter.type
                    ? {
                        ...parameter,
                        type: normalize(parameter.type),
                      }
                    : parameter
                );
                const returnType = member.returnType
                  ? normalize(member.returnType)
                  : undefined;
                const typeParameters = member.typeParameters?.map(
                  (typeParameter) =>
                    typeParameter.constraint || typeParameter.default
                      ? {
                          ...typeParameter,
                          ...(typeParameter.constraint
                            ? {
                                constraint: normalize(typeParameter.constraint),
                              }
                            : {}),
                          ...(typeParameter.default
                            ? {
                                default: normalize(typeParameter.default),
                              }
                            : {}),
                        }
                      : typeParameter
                );
                const hasChanged =
                  parameters.some(
                    (parameter, index) => parameter !== member.parameters[index]
                  ) ||
                  returnType !== member.returnType ||
                  (!!typeParameters &&
                    typeParameters.some(
                      (typeParameter, index) =>
                        typeParameter !== member.typeParameters?.[index]
                    ));
                return hasChanged
                  ? {
                      ...member,
                      parameters,
                      ...(returnType ? { returnType } : {}),
                      ...(typeParameters ? { typeParameters } : {}),
                    }
                  : member;
              }
            }
          });
          return members.some(
            (member, index) => member !== current.members[index]
          )
            ? { ...current, members }
            : current;
        }
        case "dictionaryType": {
          const keyType = normalize(current.keyType);
          const valueType = normalize(current.valueType);
          return keyType !== current.keyType || valueType !== current.valueType
            ? {
                ...current,
                keyType,
                valueType,
              }
            : current;
        }
        case "unionType":
        case "intersectionType": {
          const types = current.types.map(normalize);
          return types.some((member, index) => member !== current.types[index])
            ? {
                ...current,
                types,
              }
            : current;
        }
        case "primitiveType":
        case "typeParameterType":
        case "literalType":
        case "anyType":
        case "unknownType":
        case "voidType":
        case "neverType":
          return current;
      }
    })();

    cache.set(current, normalized);
    active.delete(current);
    return normalized;
  };

  return normalize(type);
};

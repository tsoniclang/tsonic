import {
  IrClassMember,
  IrInterfaceMember,
  IrType,
  stableIrTypeKey,
} from "@tsonic/frontend";
import {
  resolveTypeAlias,
  stripNullish,
  resolveLocalTypeInfo,
  substituteTypeArgs,
  getArrayLikeElementType,
} from "../core/semantic/type-resolution.js";
import type { EmitterContext } from "../types.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import { deriveForOfElementType } from "../core/semantic/iteration-types.js";

const ITERATOR_MEMBER_NAME = "[symbol:iterator]";

export type IterableSourceShape =
  | {
      readonly elementType: IrType;
      readonly accessKind: "direct";
    }
  | {
      readonly elementType: IrType;
      readonly accessKind: "iteratorMethod" | "iteratorProperty";
    };

export const getDirectIterableElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType") {
    return resolved.elementType;
  }
  if (resolved.kind === "tupleType") {
    if (resolved.elementTypes.length === 1) {
      return resolved.elementTypes[0];
    }
    return undefined;
  }
  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  const simpleName = (resolved.name.split(".").pop() ?? resolved.name).replace(
    /\$instance$/,
    ""
  );
  const clrSimpleName = resolved.resolvedClrType
    ?.split(".")
    .pop()
    ?.replace(/\$instance$/, "");
  if (
    simpleName === "Iterable" ||
    simpleName === "IterableIterator" ||
    simpleName === "Generator" ||
    simpleName === "AsyncIterable" ||
    simpleName === "AsyncIterableIterator" ||
    simpleName === "AsyncGenerator" ||
    simpleName === "IEnumerable" ||
    simpleName === "IEnumerable_1" ||
    simpleName === "IAsyncEnumerable_1" ||
    clrSimpleName === "IEnumerable" ||
    clrSimpleName === "IAsyncEnumerable"
  ) {
    return deriveForOfElementType(resolved, context);
  }

  return undefined;
};

const substituteLocalType = (
  type: IrType,
  typeParameters: readonly string[],
  typeArguments: readonly IrType[] | undefined
): IrType =>
  typeArguments && typeArguments.length > 0
    ? substituteTypeArgs(type, typeParameters, typeArguments)
    : type;

type IteratorMemberResolution = {
  readonly kind: "iteratorMethod" | "iteratorProperty";
  readonly returnType: IrType;
};

const resolveIteratorMemberFromMembers = (
  members: readonly (IrClassMember | IrInterfaceMember)[],
  typeParameters: readonly string[],
  typeArguments: readonly IrType[] | undefined
): IteratorMemberResolution | undefined => {
  for (const member of members) {
    if (
      (member.kind === "methodDeclaration" ||
        member.kind === "methodSignature") &&
      member.name === ITERATOR_MEMBER_NAME &&
      member.parameters.length === 0 &&
      member.returnType
    ) {
      return {
        kind: "iteratorMethod",
        returnType: substituteLocalType(
          member.returnType,
          typeParameters,
          typeArguments
        ),
      };
    }

    if (
      (member.kind === "propertyDeclaration" ||
        member.kind === "propertySignature") &&
      member.name === ITERATOR_MEMBER_NAME &&
      member.type
    ) {
      return {
        kind: "iteratorProperty",
        returnType: substituteLocalType(
          member.type,
          typeParameters,
          typeArguments
        ),
      };
    }
  }

  return undefined;
};

const resolveIteratorMemberFromReference = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext,
  visited: ReadonlySet<string> = new Set<string>()
): IteratorMemberResolution | undefined => {
  const resolvedRef = resolveTypeAlias(stripNullish(ref), context);
  if (resolvedRef.kind !== "referenceType") {
    return undefined;
  }

  const visitKey = stableIrTypeKey(resolvedRef);
  if (visited.has(visitKey)) {
    return undefined;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(visitKey);

  const structuralDirect = resolvedRef.structuralMembers
    ? resolveIteratorMemberFromMembers(resolvedRef.structuralMembers, [], undefined)
    : undefined;
  if (structuralDirect) {
    return structuralDirect;
  }

  const localInfoResult = resolveLocalTypeInfo(resolvedRef, context);
  if (!localInfoResult) {
    return undefined;
  }

  const { info } = localInfoResult;
  if (info.kind === "class") {
    const direct = resolveIteratorMemberFromMembers(
      info.members,
      info.typeParameters,
      resolvedRef.typeArguments
    );
    if (direct) {
      return direct;
    }

    if (info.superClass?.kind === "referenceType") {
      const superRef = substituteLocalType(
        info.superClass,
        info.typeParameters,
        resolvedRef.typeArguments
      );
      if (superRef.kind === "referenceType") {
        const inherited = resolveIteratorMemberFromReference(
          superRef,
          context,
          nextVisited
        );
        if (inherited) {
          return inherited;
        }
      }
    }

    for (const impl of info.implements) {
      if (impl.kind !== "referenceType") continue;
      const substitutedImpl = substituteLocalType(
        impl,
        info.typeParameters,
        resolvedRef.typeArguments
      );
      if (substitutedImpl.kind !== "referenceType") continue;
      const inherited = resolveIteratorMemberFromReference(
        substitutedImpl,
        context,
        nextVisited
      );
      if (inherited) {
        return inherited;
      }
    }

    return undefined;
  }

  if (info.kind !== "interface") {
    return undefined;
  }

  const direct = resolveIteratorMemberFromMembers(
    info.members,
    info.typeParameters,
    resolvedRef.typeArguments
  );
  if (direct) {
    return direct;
  }

  for (const ext of info.extends) {
    if (ext.kind !== "referenceType") continue;
    const substitutedExt = substituteLocalType(
      ext,
      info.typeParameters,
      resolvedRef.typeArguments
    );
    if (substitutedExt.kind !== "referenceType") continue;
    const inherited = resolveIteratorMemberFromReference(
      substitutedExt,
      context,
      nextVisited
    );
    if (inherited) {
      return inherited;
    }
  }

  return undefined;
};

export const canPreferAnonymousStructuralTarget = (type: IrType): boolean => {
  const stripped = stripNullish(type);
  if (stripped.kind !== "referenceType") {
    return true;
  }

  const simpleName = stripped.name.split(".").pop() ?? stripped.name;
  const clrSimpleName = stripped.resolvedClrType?.split(".").pop();
  const isCompilerGeneratedCarrier = (name: string | undefined): boolean =>
    !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

  return (
    isCompilerGeneratedCarrier(simpleName) ||
    isCompilerGeneratedCarrier(clrSimpleName)
  );
};

const getNominalReferenceIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): string => {
  const explicitIdentity =
    type.resolvedClrType ??
    type.typeId?.clrName ??
    (type.name.includes(".") ? type.name : undefined) ??
    (type.typeId?.tsName?.includes(".") ? type.typeId.tsName : undefined);
  if (explicitIdentity) {
    return explicitIdentity;
  }

  const resolvedLocal = resolveLocalTypeInfo(type, context);
  if (resolvedLocal) {
    const localName = type.name.split(".").pop() ?? type.name;
    const emittedLocalName =
      resolvedLocal.info.kind === "typeAlias" &&
      resolvedLocal.info.type.kind === "objectType"
        ? `${localName}__Alias`
        : localName;
    const canonicalTarget = context.options.canonicalLocalTypeTargets?.get(
      `${resolvedLocal.namespace}::${localName}`
    );
    return canonicalTarget ?? `${resolvedLocal.namespace}.${emittedLocalName}`;
  }

  return type.name;
};

export const isSameNominalType = (
  sourceType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!sourceType || !targetType) return false;

  const sourceBase = stripNullish(sourceType);
  const targetBase = stripNullish(targetType);

  if (
    sourceBase.kind === "referenceType" &&
    targetBase.kind === "referenceType"
  ) {
    if (
      getNominalReferenceIdentity(sourceBase, context) ===
      getNominalReferenceIdentity(targetBase, context)
    ) {
      return true;
    }
  }

  const sourceResolved = resolveTypeAlias(sourceBase, context);
  const targetResolved = resolveTypeAlias(targetBase, context);
  if (
    sourceResolved.kind !== "referenceType" ||
    targetResolved.kind !== "referenceType"
  ) {
    return false;
  }

  return (
    sourceResolved.name === targetResolved.name ||
    (sourceResolved.resolvedClrType !== undefined &&
      sourceResolved.resolvedClrType === targetResolved.resolvedClrType)
  );
};

export const getArrayElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => getArrayLikeElementType(type, context);

export const isObjectLikeTypeAst = (
  type: CSharpTypeAst | undefined
): boolean => {
  if (!type) return false;
  const concrete = stripNullableTypeAst(type);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  const name = getIdentifierTypeName(concrete);
  return (
    name === "object" ||
    name === "System.Object" ||
    name === "global::System.Object"
  );
};

export const getDictionaryValueType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "dictionaryType") return undefined;
  return resolved.valueType;
};

export const getIterableSourceShape = (
  type: IrType | undefined,
  context: EmitterContext
): IterableSourceShape | undefined => {
  if (!type) {
    return undefined;
  }

  const directElementType = getDirectIterableElementType(type, context);
  if (directElementType) {
    return {
      elementType: directElementType,
      accessKind: "direct",
    };
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  const iteratorMember = resolveIteratorMemberFromReference(resolved, context);
  if (!iteratorMember) {
    return undefined;
  }

  const elementType = deriveForOfElementType(iteratorMember.returnType, context);
  if (!elementType) {
    return undefined;
  }

  return {
    elementType,
    accessKind: iteratorMember.kind,
  };
};

import { IrType, IrInterfaceMember, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import { identifierType } from "../format/backend-ast/builders.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
  substituteTypeArgs,
  unionMemberMatchesTarget,
} from "./type-resolution.js";

export type EmitTypeAstLike = (
  type: IrType,
  context: EmitterContext
) => [CSharpTypeAst, EmitterContext];

export type RuntimeUnionLayout = {
  readonly members: readonly IrType[];
  readonly memberTypeAsts: readonly CSharpTypeAst[];
  readonly runtimeUnionArity: number;
};

export type RuntimeUnionFrame = {
  readonly members: readonly IrType[];
  readonly runtimeUnionArity: number;
};

const UNKNOWN_TYPE: IrType = { kind: "unknownType" };

const toRuntimeOrderingComparableType = (type: IrType): IrType => {
  if (type.kind === "literalType") {
    if (typeof type.value === "string") {
      return { kind: "primitiveType", name: "string" };
    }
    if (typeof type.value === "number") {
      return { kind: "primitiveType", name: "number" };
    }
    if (typeof type.value === "boolean") {
      return { kind: "primitiveType", name: "boolean" };
    }
  }

  if (type.kind === "unionType") {
    return {
      ...type,
      types: type.types.map((member) =>
        toRuntimeOrderingComparableType(member)
      ),
    };
  }

  return type;
};

const toRuntimeOrderingTypeKey = (type: IrType): string =>
  stableIrTypeKey(toRuntimeOrderingComparableType(type));

const buildRuntimeOrderingMemberKey = (member: IrInterfaceMember): string => {
  if (member.kind === "propertySignature") {
    return `prop:${member.name}:${member.isOptional ? "opt" : "req"}:${member.isReadonly ? "ro" : "rw"}:${toRuntimeOrderingTypeKey(member.type)}`;
  }

  const parameters = member.parameters.map(
    (parameter: (typeof member.parameters)[number]) =>
      toRuntimeOrderingTypeKey(parameter.type ?? UNKNOWN_TYPE)
  );
  return `method:${member.name}:${parameters.join(",")}:${member.parameters.length}:${toRuntimeOrderingTypeKey(member.returnType ?? UNKNOWN_TYPE)}`;
};

const buildRuntimeOrderingStructuralKey = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "objectType") {
    return resolved.members
      .map((member) => buildRuntimeOrderingMemberKey(member))
      .sort()
      .join("|");
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    return resolved.structuralMembers
      .map((member) => buildRuntimeOrderingMemberKey(member))
      .sort()
      .join("|");
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (!localInfo) {
    return undefined;
  }

  if (localInfo.kind === "typeAlias" && localInfo.type.kind === "objectType") {
    return localInfo.type.members
      .map((member) => buildRuntimeOrderingMemberKey(member))
      .sort()
      .join("|");
  }

  if (localInfo.kind !== "class" && localInfo.kind !== "interface") {
    return undefined;
  }

  const members = localInfo.members
    .flatMap<Extract<IrType, { kind: "objectType" }>["members"][number]>(
      (member) => {
        if (member.kind === "propertyDeclaration" && member.type) {
          return [
            {
              kind: "propertySignature" as const,
              name: member.name,
              type: member.type,
              isOptional: false,
              isReadonly: member.isReadonly ?? false,
            },
          ];
        }
        if (member.kind === "propertySignature") {
          return [member];
        }
        if (member.kind === "methodDeclaration") {
          return [
            {
              kind: "methodSignature" as const,
              name: member.name,
              parameters: member.parameters,
              returnType: member.returnType ?? UNKNOWN_TYPE,
            },
          ];
        }
        if (member.kind === "methodSignature") {
          return [member];
        }
        return [];
      }
    )
    .map((member) => buildRuntimeOrderingMemberKey(member))
    .sort();

  return members.length > 0 ? members.join("|") : undefined;
};

const getRuntimeUnionMemberSortKey = (
  type: IrType,
  context: EmitterContext
): string =>
  buildRuntimeOrderingStructuralKey(type, context) ??
  toRuntimeOrderingTypeKey(resolveTypeAlias(type, context));

export const isRuntimeUnionTypeName = (name: string): boolean => {
  const normalized = name.startsWith("global::")
    ? name.slice("global::".length)
    : name;
  const leaf = normalized.split(".").pop() ?? normalized;
  return (
    leaf === "Union" || /^Union_[2-8]$/.test(leaf) || /^Union`\d+$/.test(leaf)
  );
};

export const getRuntimeUnionReferenceMembers = (
  type: Extract<IrType, { kind: "referenceType" }>
): readonly IrType[] | undefined => {
  if (
    (isRuntimeUnionTypeName(type.name) ||
      (type.resolvedClrType
        ? isRuntimeUnionTypeName(type.resolvedClrType)
        : false)) &&
    type.typeArguments &&
    type.typeArguments.length >= 2 &&
    type.typeArguments.length <= 8
  ) {
    return type.typeArguments;
  }

  return undefined;
};

const toRecursiveFallbackType = (type: IrType): IrType => {
  if (type.kind === "arrayType") {
    return type;
  }

  if (type.kind === "unionType") {
    const split = splitRuntimeNullishUnionMembers(type);
    const nonNullish = split?.nonNullishMembers ?? type.types;
    if (nonNullish.length === 1 && nonNullish[0]?.kind === "arrayType") {
      return nonNullish[0];
    }
  }

  return UNKNOWN_TYPE;
};

const expandRuntimeUnionMembers = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>()
): readonly IrType[] => {
  if (activeTypes.has(type)) {
    return [toRecursiveFallbackType(type)];
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    return split.nonNullishMembers.flatMap((member) =>
      expandRuntimeUnionMembers(member, context, activeAliases, nextActiveTypes)
    );
  }

  if (type.kind === "intersectionType") {
    const runtimeCarrier = type.types.find(
      (
        member
      ): member is
        | Extract<IrType, { kind: "unionType" }>
        | Extract<IrType, { kind: "referenceType" }> =>
        member.kind === "unionType" ||
        (member.kind === "referenceType" &&
          getRuntimeUnionReferenceMembers(member) !== undefined)
    );
    if (runtimeCarrier) {
      return expandRuntimeUnionMembers(
        runtimeCarrier,
        context,
        activeAliases,
        nextActiveTypes
      );
    }
  }

  if (type.kind === "referenceType") {
    const runtimeMembers = getRuntimeUnionReferenceMembers(type);
    if (runtimeMembers) {
      return runtimeMembers.flatMap((member) =>
        expandRuntimeUnionMembers(
          member,
          context,
          activeAliases,
          nextActiveTypes
        )
      );
    }

    const localInfo = resolveLocalTypeInfo(type, context);
    if (localInfo?.info.kind === "typeAlias") {
      if (localInfo.info.type.kind === "objectType") {
        return [type];
      }

      const localName = type.name.includes(".")
        ? (type.name.split(".").pop() ?? type.name)
        : type.name;
      const aliasKey = `${localInfo.namespace}::${localName}`;
      const aliasTarget =
        type.typeArguments && type.typeArguments.length > 0
          ? substituteTypeArgs(
              localInfo.info.type,
              localInfo.info.typeParameters,
              type.typeArguments
            )
          : localInfo.info.type;

      if (activeAliases.has(aliasKey)) {
        return [toRecursiveFallbackType(aliasTarget)];
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      return expandRuntimeUnionMembers(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes
      );
    }

    const resolved = resolveTypeAlias(type, context);
    if (resolved !== type) {
      return expandRuntimeUnionMembers(
        resolved,
        context,
        activeAliases,
        nextActiveTypes
      );
    }

    return [type];
  }

  if (type.kind === "unionType") {
    return type.types.flatMap((member) =>
      expandRuntimeUnionMembers(member, context, activeAliases, nextActiveTypes)
    );
  }

  if (type.kind === "arrayType") {
    const elementMembers = expandRuntimeUnionMembers(
      type.elementType,
      context,
      activeAliases,
      nextActiveTypes
    );
    if (elementMembers.length !== 1) {
      return [
        {
          kind: "arrayType",
          elementType: UNKNOWN_TYPE,
          origin: type.origin,
        },
      ];
    }

    return [
      {
        ...type,
        elementType: elementMembers[0] ?? UNKNOWN_TYPE,
      },
    ];
  }

  return [type];
};

export const buildRuntimeUnionLayout = (
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [RuntimeUnionLayout | undefined, EmitterContext] => {
  const frame = buildRuntimeUnionFrame(type, context);
  if (!frame) {
    return [undefined, context];
  }
  const semanticMembers = frame.members;

  const byAstKey = new Map<
    string,
    { member: IrType; typeAst: CSharpTypeAst }
  >();
  let currentContext = context;

  for (const member of semanticMembers) {
    const [typeAst, nextContext] = emitTypeAst(member, currentContext);
    currentContext = nextContext;
    const key = stableTypeKeyFromAst(typeAst);
    if (!byAstKey.has(key)) {
      byAstKey.set(key, { member, typeAst });
    }
  }

  const ordered = Array.from(byAstKey.entries())
    .sort(([, left], [, right]) => {
      const leftKey = getRuntimeUnionMemberSortKey(left.member, currentContext);
      const rightKey = getRuntimeUnionMemberSortKey(
        right.member,
        currentContext
      );
      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey);
      }
      return stableTypeKeyFromAst(left.typeAst).localeCompare(
        stableTypeKeyFromAst(right.typeAst)
      );
    })
    .map(([, entry]) => entry);

  if (ordered.length < 2 || ordered.length > 8) {
    return [undefined, currentContext];
  }

  return [
    {
      members: ordered.map((entry) => entry.member),
      memberTypeAsts: ordered.map((entry) => entry.typeAst),
      runtimeUnionArity: ordered.length,
    },
    currentContext,
  ];
};

export const buildRuntimeUnionTypeAst = (
  layout: RuntimeUnionLayout
): CSharpTypeAst =>
  identifierType("global::Tsonic.Runtime.Union", [...layout.memberTypeAsts]);

export const emitRuntimeCarrierTypeAst = (
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [CSharpTypeAst, RuntimeUnionLayout | undefined, EmitterContext] => {
  const [layout, layoutContext] = buildRuntimeUnionLayout(
    type,
    context,
    emitTypeAst
  );
  if (layout) {
    return [buildRuntimeUnionTypeAst(layout), layout, layoutContext];
  }

  const [typeAst, typeContext] = emitTypeAst(type, context);
  return [typeAst, undefined, typeContext];
};

export const buildRuntimeUnionFrame = (
  type: IrType,
  context: EmitterContext
): RuntimeUnionFrame | undefined => {
  const members = getCanonicalRuntimeUnionMembers(type, context);
  if (!members) {
    return undefined;
  }

  return {
    members,
    runtimeUnionArity: members.length,
  };
};

const collectRuntimeUnionRawMembers = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>()
): readonly IrType[] => {
  if (activeTypes.has(type)) {
    return [type];
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    return split.nonNullishMembers.flatMap((member) =>
      collectRuntimeUnionRawMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes
      )
    );
  }

  if (type.kind === "intersectionType") {
    const runtimeCarrier = type.types.find(
      (
        member
      ): member is
        | Extract<IrType, { kind: "unionType" }>
        | Extract<IrType, { kind: "referenceType" }> =>
        member.kind === "unionType" ||
        (member.kind === "referenceType" &&
          getRuntimeUnionReferenceMembers(member) !== undefined)
    );
    if (runtimeCarrier) {
      return collectRuntimeUnionRawMembers(
        runtimeCarrier,
        context,
        activeAliases,
        nextActiveTypes
      );
    }
  }

  if (type.kind === "referenceType") {
    const runtimeMembers = getRuntimeUnionReferenceMembers(type);
    if (runtimeMembers) {
      return runtimeMembers.flatMap((member) =>
        collectRuntimeUnionRawMembers(
          member,
          context,
          activeAliases,
          nextActiveTypes
        )
      );
    }

    const localInfo = resolveLocalTypeInfo(type, context);
    if (localInfo?.info.kind === "typeAlias") {
      if (localInfo.info.type.kind === "objectType") {
        return [type];
      }

      const localName = type.name.includes(".")
        ? (type.name.split(".").pop() ?? type.name)
        : type.name;
      const aliasKey = `${localInfo.namespace}::${localName}`;
      const aliasTarget =
        type.typeArguments && type.typeArguments.length > 0
          ? substituteTypeArgs(
              localInfo.info.type,
              localInfo.info.typeParameters,
              type.typeArguments
            )
          : localInfo.info.type;

      if (activeAliases.has(aliasKey)) {
        return [type];
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      return collectRuntimeUnionRawMembers(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes
      );
    }

    const resolved = resolveTypeAlias(type, context);
    if (resolved !== type) {
      return collectRuntimeUnionRawMembers(
        resolved,
        context,
        activeAliases,
        nextActiveTypes
      );
    }
  }

  if (type.kind === "unionType") {
    return type.types.flatMap((member) =>
      collectRuntimeUnionRawMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes
      )
    );
  }

  return [type];
};

const isRuntimeUnionElementFamily = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>()
): boolean => {
  if (activeTypes.has(type)) {
    return true;
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    if (split.nonNullishMembers.length > 1) {
      return true;
    }
    const onlyMember = split.nonNullishMembers[0];
    return onlyMember
      ? isRuntimeUnionElementFamily(
          onlyMember,
          context,
          activeAliases,
          nextActiveTypes
        )
      : false;
  }

  if (type.kind === "unionType") {
    return true;
  }

  if (type.kind === "intersectionType") {
    const runtimeCarrier = type.types.find(
      (
        member
      ): member is
        | Extract<IrType, { kind: "unionType" }>
        | Extract<IrType, { kind: "referenceType" }> =>
        member.kind === "unionType" ||
        (member.kind === "referenceType" &&
          getRuntimeUnionReferenceMembers(member) !== undefined)
    );
    return runtimeCarrier
      ? isRuntimeUnionElementFamily(
          runtimeCarrier,
          context,
          activeAliases,
          nextActiveTypes
        )
      : false;
  }

  if (type.kind === "arrayType") {
    return isRuntimeUnionElementFamily(
      type.elementType,
      context,
      activeAliases,
      nextActiveTypes
    );
  }

  if (type.kind === "referenceType") {
    if (getRuntimeUnionReferenceMembers(type)) {
      return true;
    }

    const localInfo = resolveLocalTypeInfo(type, context);
    if (localInfo?.info.kind === "typeAlias") {
      if (localInfo.info.type.kind === "objectType") {
        return false;
      }

      const localName = type.name.includes(".")
        ? (type.name.split(".").pop() ?? type.name)
        : type.name;
      const aliasKey = `${localInfo.namespace}::${localName}`;
      const aliasTarget =
        type.typeArguments && type.typeArguments.length > 0
          ? substituteTypeArgs(
              localInfo.info.type,
              localInfo.info.typeParameters,
              type.typeArguments
            )
          : localInfo.info.type;

      if (activeAliases.has(aliasKey)) {
        return true;
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      return isRuntimeUnionElementFamily(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes
      );
    }

    const resolved = resolveTypeAlias(type, context);
    if (resolved !== type) {
      return isRuntimeUnionElementFamily(
        resolved,
        context,
        activeAliases,
        nextActiveTypes
      );
    }
  }

  return false;
};

export const hasRuntimeUnionArrayMemberWithRuntimeUnionElements = (
  type: IrType,
  context: EmitterContext
): boolean => {
  return collectRuntimeUnionRawMembers(type, context).some((member) => {
    const resolvedMember = resolveTypeAlias(member, context);
    return (
      resolvedMember.kind === "arrayType" &&
      isRuntimeUnionElementFamily(resolvedMember.elementType, context)
    );
  });
};

export const shouldEraseRecursiveRuntimeUnionArrayElement = (
  type: IrType,
  context: EmitterContext
): boolean => {
  return hasRuntimeUnionArrayMemberWithRuntimeUnionElements(type, context);
};

export const getCanonicalRuntimeUnionMembers = (
  type: IrType,
  context: EmitterContext
): readonly IrType[] | undefined => {
  const semanticMembers = expandRuntimeUnionMembers(type, context);
  if (semanticMembers.length < 2 || semanticMembers.length > 8) {
    return undefined;
  }

  const deduped = new Map<string, IrType>();
  for (const member of semanticMembers) {
    deduped.set(stableIrTypeKey(member), member);
  }

  return Array.from(deduped.entries())
    .map(([, member]) => member)
    .sort((left, right) => {
      const leftKey = getRuntimeUnionMemberSortKey(left, context);
      const rightKey = getRuntimeUnionMemberSortKey(right, context);
      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey);
      }
      return stableIrTypeKey(left).localeCompare(stableIrTypeKey(right));
    });
};

export const findRuntimeUnionMemberIndex = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): number | undefined => {
  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    if (member && unionMemberMatchesTarget(member, target, context)) {
      return i;
    }
  }
  return undefined;
};

export const findRuntimeUnionMemberIndices = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): readonly number[] =>
  members.flatMap((member, index) =>
    member && unionMemberMatchesTarget(member, target, context) ? [index] : []
  );

export const findExactRuntimeUnionMemberIndices = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): readonly number[] => {
  const targetKey = stableIrTypeKey(
    resolveTypeAlias(stripNullish(target), context)
  );
  return members.flatMap((member, index) => {
    if (!member) {
      return [];
    }
    const memberKey = stableIrTypeKey(
      resolveTypeAlias(stripNullish(member), context)
    );
    return memberKey === targetKey ? [index] : [];
  });
};

const referenceTypeCanContainInstanceofTarget = (
  member: Extract<IrType, { kind: "referenceType" }>,
  target: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext,
  seen: ReadonlySet<string> = new Set<string>()
): boolean => {
  if (unionMemberMatchesTarget(member, target, context)) {
    return true;
  }

  const targetKey = stableIrTypeKey(target);
  if (seen.has(targetKey)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(targetKey);

  const info = resolveLocalTypeInfo(target, context)?.info;
  if (!info) {
    return false;
  }

  if (info.kind === "class") {
    if (info.superClass) {
      const resolvedSuper = resolveTypeAlias(info.superClass, context);
      if (
        resolvedSuper.kind === "referenceType" &&
        referenceTypeCanContainInstanceofTarget(
          member,
          resolvedSuper,
          context,
          nextSeen
        )
      ) {
        return true;
      }
    }

    for (const implemented of info.implements) {
      const resolvedImplemented = resolveTypeAlias(implemented, context);
      if (
        resolvedImplemented.kind === "referenceType" &&
        referenceTypeCanContainInstanceofTarget(
          member,
          resolvedImplemented,
          context,
          nextSeen
        )
      ) {
        return true;
      }
    }
  }

  if (info.kind === "interface") {
    for (const extended of info.extends) {
      const resolvedExtended = resolveTypeAlias(extended, context);
      if (
        resolvedExtended.kind === "referenceType" &&
        referenceTypeCanContainInstanceofTarget(
          member,
          resolvedExtended,
          context,
          nextSeen
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

export const findRuntimeUnionInstanceofMemberIndices = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): readonly number[] => {
  const resolvedTarget = resolveTypeAlias(stripNullish(target), context);

  return members.flatMap((member, index) => {
    if (!member) {
      return [];
    }

    if (unionMemberMatchesTarget(member, resolvedTarget, context)) {
      return [index];
    }

    const resolvedMember = resolveTypeAlias(stripNullish(member), context);
    if (
      resolvedMember.kind === "referenceType" &&
      resolvedTarget.kind === "referenceType" &&
      referenceTypeCanContainInstanceofTarget(
        resolvedMember,
        resolvedTarget,
        context
      )
    ) {
      return [index];
    }

    return [];
  });
};

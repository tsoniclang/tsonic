import { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
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

const UNKNOWN_TYPE: IrType = { kind: "unknownType" };

const isClrUnionName = (name: string): boolean =>
  name === "Union" ||
  name === "Tsonic.Runtime.Union" ||
  name === "global::Tsonic.Runtime.Union";

const toRecursiveFallbackType = (type: IrType): IrType => {
  if (type.kind === "arrayType") {
    return {
      kind: "arrayType",
      elementType: UNKNOWN_TYPE,
      origin: type.origin,
    };
  }

  if (type.kind === "unionType") {
    const split = splitRuntimeNullishUnionMembers(type);
    const nonNullish = split?.nonNullishMembers ?? type.types;
    if (nonNullish.length === 1 && nonNullish[0]?.kind === "arrayType") {
      return {
        kind: "arrayType",
        elementType: UNKNOWN_TYPE,
        origin: nonNullish[0].origin,
      };
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

  if (type.kind === "referenceType") {
    if (
      isClrUnionName(type.name) &&
      type.typeArguments &&
      type.typeArguments.length >= 2 &&
      type.typeArguments.length <= 8
    ) {
      return type.typeArguments.flatMap((member) =>
        expandRuntimeUnionMembers(member, context, activeAliases, nextActiveTypes)
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
  const semanticMembers = expandRuntimeUnionMembers(type, context);
  if (semanticMembers.length < 2 || semanticMembers.length > 8) {
    return [undefined, context];
  }

  const byAstKey = new Map<string, { member: IrType; typeAst: CSharpTypeAst }>();
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
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, entry]) => entry);

  return [
    {
      members: ordered.map((entry) => entry.member),
      memberTypeAsts: ordered.map((entry) => entry.typeAst),
      runtimeUnionArity: ordered.length,
    },
    currentContext,
  ];
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

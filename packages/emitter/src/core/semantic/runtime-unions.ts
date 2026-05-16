import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import { identifierType } from "../format/backend-ast/builders.js";
import type {
  EmitTypeAstLike,
  RuntimeUnionLayout,
} from "./runtime-union-shared.js";
import { resolveStructuralReferenceType } from "./structural-shape-matching.js";
import { resolveLocalTypeInfo, resolveTypeAlias } from "./type-resolution.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionAssignableMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
  findRuntimeUnionMemberIndex,
  findRuntimeUnionMemberIndices,
} from "./runtime-union-matching.js";
import { getOrRegisterRuntimeUnionCarrier } from "./runtime-union-registry.js";
import { getContextualTypeVisitKey } from "./deterministic-type-keys.js";
import { buildRuntimeUnionFrame } from "./runtime-union-frame.js";
export {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionAssignableMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
  findRuntimeUnionMemberIndex,
  findRuntimeUnionMemberIndices,
};
export type {
  EmitTypeAstLike,
  RuntimeUnionFrame,
  RuntimeUnionLayout,
} from "./runtime-union-shared.js";
export {
  buildRuntimeUnionFrame,
  getCanonicalRuntimeUnionMembers,
} from "./runtime-union-frame.js";
export {
  getRuntimeUnionReferenceMembers,
  isRuntimeUnionTypeName,
} from "./runtime-union-shared.js";

export const buildRuntimeUnionLayout = (
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [RuntimeUnionLayout | undefined, EmitterContext] => {
  const layoutSourceType =
    type.kind === "referenceType" ? resolveTypeAlias(type, context) : type;
  const layoutKey =
    layoutSourceType.kind === "unionType" &&
    layoutSourceType.runtimeCarrierFamilyKey
      ? `carrier:${layoutSourceType.runtimeCarrierFamilyKey}`
      : `type:${getContextualTypeVisitKey(layoutSourceType, context)}`;
  if (context.activeRuntimeUnionLayoutKeys?.has(layoutKey)) {
    return [undefined, context];
  }

  const activeRuntimeUnionLayoutKeys = new Set(
    context.activeRuntimeUnionLayoutKeys ?? []
  );
  activeRuntimeUnionLayoutKeys.add(layoutKey);
  const guardedContext: EmitterContext = {
    ...context,
    activeRuntimeUnionLayoutKeys,
  };
  const restoreLayoutContext = (nextContext: EmitterContext): EmitterContext =>
    nextContext.activeRuntimeUnionLayoutKeys ===
    context.activeRuntimeUnionLayoutKeys
      ? nextContext
      : {
          ...nextContext,
          activeRuntimeUnionLayoutKeys: context.activeRuntimeUnionLayoutKeys,
        };

  const frame = buildRuntimeUnionFrame(layoutSourceType, guardedContext);
  if (!frame) {
    return [undefined, context];
  }
  const semanticMembers = frame.members;
  const hasCarrierSlotLayout =
    layoutSourceType.kind === "unionType" &&
    layoutSourceType.runtimeUnionLayout === "carrierSlotOrder";

  const orderedMembers: { member: IrType; typeAst: CSharpTypeAst }[] = [];
  const byAstKey = hasCarrierSlotLayout
    ? undefined
    : new Map<string, { member: IrType; typeAst: CSharpTypeAst }>();
  let currentContext = guardedContext;

  for (const member of semanticMembers) {
    const carrierMember =
      resolveStructuralReferenceType(member, currentContext) ?? member;
    const emissionContext = currentContext.preferResolvedLocalClrIdentity
      ? currentContext
      : { ...currentContext, preferResolvedLocalClrIdentity: true };
    const [typeAst, nextContext] = emitTypeAst(carrierMember, emissionContext);
    currentContext =
      emissionContext === currentContext
        ? nextContext
        : {
            ...nextContext,
            preferResolvedLocalClrIdentity:
              currentContext.preferResolvedLocalClrIdentity,
          };
    if (hasCarrierSlotLayout) {
      orderedMembers.push({ member, typeAst });
      continue;
    }
    const key = stableTypeKeyFromAst(typeAst);
    if (byAstKey && !byAstKey.has(key)) {
      byAstKey.set(key, { member, typeAst });
    }
  }

  const ordered = hasCarrierSlotLayout
    ? orderedMembers
    : Array.from(byAstKey?.values() ?? []);

  if (ordered.length < 2) {
    return [undefined, restoreLayoutContext(currentContext)];
  }

  const carrierMetadata =
    layoutSourceType.kind === "unionType" &&
    layoutSourceType.runtimeCarrierFamilyKey
      ? {
          familyKey: layoutSourceType.runtimeCarrierFamilyKey,
          name: layoutSourceType.runtimeCarrierName,
          namespaceName: layoutSourceType.runtimeCarrierNamespace,
          typeParameters: layoutSourceType.runtimeCarrierTypeParameters,
        }
      : undefined;
  const [sourceAliasMetadata, sourceAliasContext] = carrierMetadata
    ? buildSourceAliasCarrierMetadata(
        type,
        layoutSourceType,
        currentContext,
        emitTypeAst
      )
    : [undefined, currentContext];
  const layoutEntries = ordered;

  const carrier = getOrRegisterRuntimeUnionCarrier(
    layoutEntries.map((entry) => entry.typeAst),
    sourceAliasContext.options.runtimeUnionRegistry,
    carrierMetadata
      ? {
          ...carrierMetadata,
          ...(sourceAliasMetadata?.typeParameters !== undefined
            ? { typeParameters: sourceAliasMetadata.typeParameters }
            : {}),
          ...(sourceAliasMetadata?.definitionMemberTypeAsts !== undefined
            ? {
                definitionMemberTypeAsts:
                  sourceAliasMetadata.definitionMemberTypeAsts,
              }
            : {}),
          ...(sourceAliasMetadata?.accessModifier !== undefined
            ? { accessModifier: sourceAliasMetadata.accessModifier }
            : {}),
        }
      : undefined
  );

  return [
    {
      members: layoutEntries.map((entry) => entry.member),
      memberTypeAsts: layoutEntries.map((entry) => entry.typeAst),
      carrierTypeArgumentAsts:
        carrier.typeParameters.length === 0
          ? []
          : (sourceAliasMetadata?.typeArgumentAsts ??
            layoutEntries.map((entry) => entry.typeAst)),
      runtimeUnionArity: layoutEntries.length,
      carrierName: carrier.name,
      carrierFullName: carrier.fullName,
    },
    restoreLayoutContext(sourceAliasContext),
  ];
};

const buildSourceAliasCarrierMetadata = (
  requestedType: IrType,
  layoutSourceType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [
  (
    | {
        readonly typeParameters: readonly string[];
        readonly typeArgumentAsts: readonly CSharpTypeAst[];
        readonly definitionMembers: readonly IrType[];
        readonly definitionMemberTypeAsts: readonly CSharpTypeAst[];
        readonly accessModifier: "public" | "internal";
      }
    | undefined
  ),
  EmitterContext,
] => {
  if (
    layoutSourceType.kind !== "unionType" ||
    !layoutSourceType.runtimeCarrierFamilyKey
  ) {
    return [undefined, context];
  }

  const aliasLookupReference: Extract<IrType, { kind: "referenceType" }> =
    requestedType.kind === "referenceType"
      ? requestedType
      : {
          kind: "referenceType",
          name: layoutSourceType.runtimeCarrierName ?? "",
          ...(layoutSourceType.runtimeCarrierNamespace &&
          layoutSourceType.runtimeCarrierName
            ? {
                resolvedClrType: `${layoutSourceType.runtimeCarrierNamespace}.${layoutSourceType.runtimeCarrierName}`,
              }
            : {}),
        };
  if (aliasLookupReference.name.length === 0) {
    return [undefined, context];
  }

  const aliasInfo = resolveLocalTypeInfo(aliasLookupReference, context);
  if (!aliasInfo || aliasInfo.info.kind !== "typeAlias") {
    return [undefined, context];
  }
  const targetModulePublicLocalTypes =
    aliasInfo.namespace ===
    (context.moduleNamespace ?? context.options.rootNamespace)
      ? context.publicLocalTypes
      : [...(context.options.moduleMap?.values() ?? [])].find(
          (moduleInfo) =>
            moduleInfo.namespace === aliasInfo.namespace &&
            moduleInfo.localTypes?.has(aliasInfo.name)
        )?.publicLocalTypes;
  const accessModifier =
    aliasInfo.info.isExported === true ||
    targetModulePublicLocalTypes?.has(aliasInfo.name)
      ? "public"
      : "internal";
  const aliasOwnerModule = [
    ...(context.options.moduleMap?.values() ?? []),
  ].find(
    (moduleInfo) =>
      moduleInfo.namespace === aliasInfo.namespace &&
      moduleInfo.localTypes?.has(aliasInfo.name)
  );

  const typeParameters =
    layoutSourceType.runtimeCarrierTypeParameters ??
    aliasInfo.info.typeParameters;
  const typeArgumentTypes =
    requestedType.kind === "referenceType" &&
    requestedType.typeArguments &&
    requestedType.typeArguments.length > 0
      ? requestedType.typeArguments
      : layoutSourceType.runtimeCarrierTypeArguments &&
          layoutSourceType.runtimeCarrierTypeArguments.length > 0
        ? layoutSourceType.runtimeCarrierTypeArguments
        : typeParameters.map(
            (name): IrType => ({ kind: "typeParameterType", name })
          );
  const definitionContext: EmitterContext = {
    ...context,
    moduleNamespace: aliasInfo.namespace,
    localTypes: aliasOwnerModule?.localTypes ?? context.localTypes,
    publicLocalTypes:
      aliasOwnerModule?.publicLocalTypes ??
      targetModulePublicLocalTypes ??
      context.publicLocalTypes,
    qualifyLocalTypes: false,
    preferResolvedLocalClrIdentity: false,
    typeParameters: new Set([
      ...(context.typeParameters ?? []),
      ...typeParameters,
    ]),
  };
  const definitionFrame = buildRuntimeUnionFrame(
    aliasInfo.info.type,
    definitionContext
  );
  if (!definitionFrame) {
    return [undefined, context];
  }

  let currentContext = definitionContext;
  const definitionMemberTypeAsts: CSharpTypeAst[] = [];
  for (const member of definitionFrame.members) {
    const carrierMember =
      resolveStructuralReferenceType(member, currentContext) ?? member;
    const [memberTypeAst, nextContext] = emitTypeAst(
      carrierMember,
      currentContext
    );
    definitionMemberTypeAsts.push(memberTypeAst);
    currentContext = nextContext;
  }

  const typeArgumentAsts: CSharpTypeAst[] = [];
  for (const typeArgument of typeArgumentTypes) {
    const [typeArgumentAst, nextContext] = emitTypeAst(
      typeArgument,
      currentContext
    );
    typeArgumentAsts.push(typeArgumentAst);
    currentContext = nextContext;
  }

  return [
    {
      typeParameters,
      typeArgumentAsts,
      definitionMembers: definitionFrame.members,
      definitionMemberTypeAsts,
      accessModifier,
    },
    {
      ...currentContext,
      moduleNamespace: context.moduleNamespace,
      localTypes: context.localTypes,
      publicLocalTypes: context.publicLocalTypes,
      qualifyLocalTypes: context.qualifyLocalTypes,
      preferResolvedLocalClrIdentity: context.preferResolvedLocalClrIdentity,
      typeParameters: context.typeParameters,
    },
  ];
};

export const buildRuntimeUnionTypeAst = (
  layout: RuntimeUnionLayout
): CSharpTypeAst => {
  const carrierName =
    layout.carrierFullName ??
    getOrRegisterRuntimeUnionCarrier(layout.memberTypeAsts, undefined).fullName;
  return identifierType(`global::${carrierName}`, [
    ...layout.carrierTypeArgumentAsts,
  ]);
};

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

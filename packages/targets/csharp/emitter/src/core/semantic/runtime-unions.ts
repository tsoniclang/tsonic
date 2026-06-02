import type { IrInterfaceMember, IrParameter, IrType } from "@tsonic/frontend";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpParameterAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import { printType } from "../format/backend-ast/printer-precedence.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import { identifierType } from "../format/backend-ast/builders.js";
import type {
  EmitTypeAstLike,
  RuntimeUnionLayout,
} from "./runtime-union-shared.js";
import { resolveStructuralReferenceType } from "./structural-shape-matching.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  substituteTypeArgs,
} from "./type-resolution.js";
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
import {
  collectEffectiveInterfaceMemberEntries,
  localInterfaceInfoEmitsAsNative,
} from "./native-interfaces.js";
import { isMutablePropertySlot } from "./mutable-storage.js";
import { normalizeValueSlotType } from "./value-slot-types.js";
import { emitCSharpName } from "../../naming-policy.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
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
          ...(sourceAliasMetadata?.implementedInterfaceTypeAsts !== undefined
            ? {
                implementedInterfaceTypeAsts:
                  sourceAliasMetadata.implementedInterfaceTypeAsts,
              }
            : {}),
          ...(sourceAliasMetadata?.forwardedInterfaceMembers !== undefined
            ? {
                forwardedInterfaceMembers:
                  sourceAliasMetadata.forwardedInterfaceMembers,
              }
            : {}),
          ...(sourceAliasMetadata?.accessModifier !== undefined
            ? { accessModifier: sourceAliasMetadata.accessModifier }
            : {}),
        }
      : undefined
  );
  const [carrierTypeArgumentAsts, carrierTypeArgumentContext] =
    buildCarrierTypeArgumentAsts({
      carrierTypeParameters: carrier.typeParameters,
      sourceAliasTypeArgumentAsts: sourceAliasMetadata?.typeArgumentAsts,
      layoutSourceType,
      layoutEntries,
      context: sourceAliasContext,
      emitTypeAst,
    });

  return [
    {
      members: layoutEntries.map((entry) => entry.member),
      memberTypeAsts: layoutEntries.map((entry) => entry.typeAst),
      carrierTypeArgumentAsts,
      runtimeUnionArity: layoutEntries.length,
      carrierName: carrier.name,
      carrierFullName: carrier.fullName,
    },
    restoreLayoutContext(carrierTypeArgumentContext),
  ];
};

const buildCarrierTypeArgumentAsts = (opts: {
  readonly carrierTypeParameters: readonly string[];
  readonly sourceAliasTypeArgumentAsts?: readonly CSharpTypeAst[];
  readonly layoutSourceType: IrType;
  readonly layoutEntries: readonly {
    readonly member: IrType;
    readonly typeAst: CSharpTypeAst;
  }[];
  readonly context: EmitterContext;
  readonly emitTypeAst: EmitTypeAstLike;
}): [readonly CSharpTypeAst[], EmitterContext] => {
  const {
    carrierTypeParameters,
    sourceAliasTypeArgumentAsts,
    layoutSourceType,
    layoutEntries,
    context,
    emitTypeAst,
  } = opts;

  if (carrierTypeParameters.length === 0) {
    return [[], context];
  }

  if (sourceAliasTypeArgumentAsts) {
    return [sourceAliasTypeArgumentAsts, context];
  }

  if (
    layoutSourceType.kind === "unionType" &&
    layoutSourceType.runtimeCarrierTypeArguments &&
    layoutSourceType.runtimeCarrierTypeArguments.length > 0
  ) {
    const typeArgumentAsts: CSharpTypeAst[] = [];
    let currentContext = context;
    for (const typeArgument of layoutSourceType.runtimeCarrierTypeArguments) {
      const [typeArgumentAst, nextContext] = emitTypeAst(
        typeArgument,
        currentContext
      );
      typeArgumentAsts.push(typeArgumentAst);
      currentContext = nextContext;
    }
    return [typeArgumentAsts, currentContext];
  }

  if (
    layoutSourceType.kind === "unionType" &&
    layoutSourceType.runtimeCarrierTypeParameters &&
    layoutSourceType.runtimeCarrierTypeParameters.length > 0
  ) {
    return [
      layoutSourceType.runtimeCarrierTypeParameters.map((name) =>
        identifierType(name)
      ),
      context,
    ];
  }

  return [layoutEntries.map((entry) => entry.typeAst), context];
};

type NativeInterfaceContract = {
  readonly key: string;
  readonly ref: Extract<IrType, { kind: "referenceType" }>;
  readonly info: Extract<LocalTypeInfo, { kind: "interface" }>;
};

const memberParameterTypeKey = (member: CSharpMemberAst): string => {
  switch (member.kind) {
    case "methodDeclaration":
    case "constructorDeclaration":
    case "delegateDeclaration":
      return member.parameters
        .map((parameter) => stableTypeKeyFromAst(parameter.type))
        .join(",");
    case "fieldDeclaration":
    case "propertyDeclaration":
      return "";
  }
};

type NativeInterfaceContractCache = Map<
  string,
  ReadonlyMap<string, NativeInterfaceContract>
>;

const nativeInterfaceVisitObjectIds = new WeakMap<object, number>();
let nextNativeInterfaceVisitObjectId = 0;

const getNativeInterfaceVisitObjectId = (type: object): number => {
  const existing = nativeInterfaceVisitObjectIds.get(type);
  if (existing !== undefined) {
    return existing;
  }

  const next = nextNativeInterfaceVisitObjectId;
  nextNativeInterfaceVisitObjectId += 1;
  nativeInterfaceVisitObjectIds.set(type, next);
  return next;
};

const nativeInterfaceVisitKey = (type: IrType, depth = 0): string => {
  if (depth > 4) {
    return `${type.kind}:depth`;
  }

  switch (type.kind) {
    case "referenceType": {
      const identity =
        type.providerQualifiedName ??
        type.typeId?.stableId ??
        type.typeId?.providerName ??
        type.typeId?.sourceName ??
        type.name;
      const typeArguments =
        type.typeArguments && type.typeArguments.length > 0
          ? `<${type.typeArguments
              .map((typeArgument) =>
                nativeInterfaceVisitKey(typeArgument, depth + 1)
              )
              .join(",")}>`
          : "";
      return `ref:${identity}${typeArguments}`;
    }
    case "typeParameterType":
      return `typeParameter:${type.name}`;
    case "primitiveType":
      return `primitive:${type.name}`;
    case "literalType":
      return `literal:${JSON.stringify(type.value)}`;
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return type.kind;
    default:
      return `${type.kind}:${getNativeInterfaceVisitObjectId(type)}`;
  }
};

const referenceContractKey = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): string => getContextualTypeVisitKey(ref, context);

const collectNativeInterfaceContracts = (
  type: IrType,
  context: EmitterContext,
  visited: ReadonlySet<string> = new Set<string>(),
  cache: NativeInterfaceContractCache = new Map()
): ReadonlyMap<string, NativeInterfaceContract> => {
  const visitKey = nativeInterfaceVisitKey(type);
  if (visited.has(visitKey)) {
    return new Map<string, NativeInterfaceContract>();
  }

  const cached = cache.get(visitKey);
  if (cached) {
    return cached;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(visitKey);
  const contracts = new Map<string, NativeInterfaceContract>();
  const appendNested = (nestedType: IrType): void => {
    for (const [key, contract] of collectNativeInterfaceContracts(
      nestedType,
      context,
      nextVisited,
      cache
    )) {
      contracts.set(key, contract);
    }
  };
  const intersectNested = (
    nestedTypes: readonly IrType[]
  ): ReadonlyMap<string, NativeInterfaceContract> => {
    let common: Map<string, NativeInterfaceContract> | undefined;
    for (const nestedType of nestedTypes) {
      const nestedContracts = collectNativeInterfaceContracts(
        nestedType,
        context,
        nextVisited,
        cache
      );
      if (common === undefined) {
        common = new Map(nestedContracts);
        continue;
      }
      for (const key of common.keys()) {
        if (!nestedContracts.has(key)) {
          common.delete(key);
        }
      }
    }
    return common ?? new Map<string, NativeInterfaceContract>();
  };

  if (type.kind === "typeParameterType") {
    cache.set(visitKey, contracts);
    return contracts;
  }

  if (type.kind === "unionType") {
    for (const [key, contract] of intersectNested(type.types)) {
      contracts.set(key, contract);
    }
    cache.set(visitKey, contracts);
    return contracts;
  }

  if (type.kind === "intersectionType") {
    for (const nested of type.types) {
      appendNested(nested);
    }
    cache.set(visitKey, contracts);
    return contracts;
  }

  if (type.kind !== "referenceType") {
    cache.set(visitKey, contracts);
    return contracts;
  }

  const local = resolveLocalTypeInfo(type, context);
  if (!local) {
    cache.set(visitKey, contracts);
    return contracts;
  }

  const localKey = `${local.namespace}:${local.name}:${referenceContractKey(type, context)}`;
  if (visited.has(localKey)) {
    return contracts;
  }
  const nestedVisited = new Set(nextVisited);
  nestedVisited.add(localKey);

  if (local.info.kind === "typeAlias") {
    for (const [key, contract] of collectNativeInterfaceContracts(
      local.info.type,
      context,
      nestedVisited,
      cache
    )) {
      contracts.set(key, contract);
    }
    cache.set(visitKey, contracts);
    return contracts;
  }

  const specialize = (heritage: IrType): IrType =>
    type.typeArguments && type.typeArguments.length > 0
      ? substituteTypeArgs(
          heritage,
          local.info.kind === "class" || local.info.kind === "interface"
            ? local.info.typeParameters
            : [],
          type.typeArguments
        )
      : heritage;

  if (
    local.info.kind === "interface" &&
    localInterfaceInfoEmitsAsNative(
      local.info,
      local.namespace,
      local.name,
      context
    )
  ) {
    const contractRef: Extract<IrType, { kind: "referenceType" }> = {
      ...type,
      name: local.name,
      providerQualifiedName: `${local.namespace}.${local.name}`,
    };
    contracts.set(referenceContractKey(contractRef, context), {
      key: referenceContractKey(contractRef, context),
      ref: contractRef,
      info: local.info,
    });
  }

  const heritageTypes =
    local.info.kind === "interface"
      ? local.info.extends
      : local.info.kind === "class"
        ? [
            ...(local.info.superClass ? [local.info.superClass] : []),
            ...local.info.implements,
          ]
        : [];

  for (const heritage of heritageTypes) {
    for (const [key, contract] of collectNativeInterfaceContracts(
      specialize(heritage),
      context,
      nestedVisited,
      cache
    )) {
      contracts.set(key, contract);
    }
  }

  cache.set(visitKey, contracts);
  return contracts;
};

const intersectCommonNativeInterfaceContracts = (
  members: readonly IrType[],
  context: EmitterContext
): readonly NativeInterfaceContract[] => {
  let common: Map<string, NativeInterfaceContract> | undefined;
  const cache: NativeInterfaceContractCache = new Map();
  for (const member of members) {
    const memberContracts = collectNativeInterfaceContracts(
      member,
      context,
      new Set<string>(),
      cache
    );
    if (common === undefined) {
      common = new Map(memberContracts);
      continue;
    }

    for (const key of common.keys()) {
      if (!memberContracts.has(key)) {
        common.delete(key);
      }
    }
  }

  return [...(common?.values() ?? [])].sort((left, right) =>
    left.key.localeCompare(right.key)
  );
};

const commonInterfaceCarrierMembersByOptions = new WeakMap<
  object,
  Map<
    string,
    {
      readonly implementedInterfaceTypeAsts: readonly CSharpTypeAst[];
      readonly forwardedInterfaceMembers: readonly CSharpMemberAst[];
    }
  >
>();

const getCommonInterfaceCarrierMembersCache = (
  context: EmitterContext
): Map<
  string,
  {
    readonly implementedInterfaceTypeAsts: readonly CSharpTypeAst[];
    readonly forwardedInterfaceMembers: readonly CSharpMemberAst[];
  }
> => {
  let cache = commonInterfaceCarrierMembersByOptions.get(context.options);
  if (!cache) {
    cache = new Map();
    commonInterfaceCarrierMembersByOptions.set(context.options, cache);
  }
  return cache;
};

const nullableTypeAst = (typeAst: CSharpTypeAst): CSharpTypeAst =>
  typeAst.kind === "nullableType"
    ? typeAst
    : { kind: "nullableType", underlyingType: typeAst };

const valueExpression = (): CSharpExpressionAst => ({
  kind: "identifierExpression",
  identifier: "value",
});

const unionValueAsInterfaceExpression = (
  interfaceTypeAst: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "castExpression",
  type: interfaceTypeAst,
  expression: { kind: "identifierExpression", identifier: "_value" },
});

const interfaceMemberAccessExpression = (
  interfaceTypeAst: CSharpTypeAst,
  memberName: string
): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression: unionValueAsInterfaceExpression(interfaceTypeAst),
  memberName,
});

const emitForwardingParameterAsts = (
  parameters: readonly IrParameter[],
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [readonly CSharpParameterAst[], EmitterContext] => {
  const parameterAsts: CSharpParameterAst[] = [];
  let currentContext = context;
  for (let index = 0; index < parameters.length; index += 1) {
    const parameter = parameters[index];
    if (!parameter) continue;

    const [typeAst, typeContext] = parameter.type
      ? emitTypeAst(parameter.type, currentContext)
      : [identifierType("object"), currentContext];
    currentContext = typeContext;

    const parameterName =
      parameter.pattern.kind === "identifierPattern"
        ? escapeCSharpIdentifier(parameter.pattern.name)
        : `param${index}`;
    const modifiers = [
      ...(parameter.isRest ? ["params"] : []),
      ...(parameter.passing !== "value" ? [parameter.passing] : []),
    ];
    parameterAsts.push({
      name: parameterName,
      type: parameter.isOptional ? nullableTypeAst(typeAst) : typeAst,
      ...(modifiers.length > 0 ? { modifiers } : {}),
    });
  }
  return [parameterAsts, currentContext];
};

const parameterReferenceExpression = (
  parameter: CSharpParameterAst
): CSharpExpressionAst => ({
  kind: "identifierExpression",
  identifier: parameter.name,
});

const buildForwardedInterfaceMember = (
  member: IrInterfaceMember,
  explicitInterfaceTypeAst: CSharpTypeAst,
  explicitInterfaceName: string,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [CSharpMemberAst, EmitterContext] => {
  if (member.kind === "propertySignature") {
    const [baseTypeAst, typeContext] = emitTypeAst(
      normalizeValueSlotType(member.type),
      context
    );
    const memberName = emitCSharpName(member.name, "properties", context);
    const typeAst = member.isOptional
      ? nullableTypeAst(baseTypeAst)
      : baseTypeAst;
    const hasSetter =
      !member.isReadonly ||
      isMutablePropertySlot(explicitInterfaceName, member.name, typeContext);

    return [
      {
        kind: "propertyDeclaration",
        attributes: [],
        modifiers: [],
        type: typeAst,
        name: memberName,
        explicitInterface: explicitInterfaceTypeAst,
        hasGetter: true,
        hasSetter,
        isAutoProperty: false,
        getterBody: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: interfaceMemberAccessExpression(
                explicitInterfaceTypeAst,
                memberName
              ),
            },
          ],
        },
        setterBody: hasSetter
          ? {
              kind: "blockStatement",
              statements: [
                {
                  kind: "expressionStatement",
                  expression: {
                    kind: "assignmentExpression",
                    operatorToken: "=",
                    left: interfaceMemberAccessExpression(
                      explicitInterfaceTypeAst,
                      memberName
                    ),
                    right: valueExpression(),
                  },
                },
              ],
            }
          : undefined,
      },
      typeContext,
    ];
  }

  const scopedTypeParameters = new Set([
    ...(context.typeParameters ?? []),
    ...(member.typeParameters?.map((typeParameter) => typeParameter.name) ??
      []),
  ]);
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: scopedTypeParameters,
  };
  const [returnTypeAst, returnTypeContext] = member.returnType
    ? emitTypeAst(member.returnType, currentContext)
    : [identifierType("void"), currentContext];
  currentContext = returnTypeContext;
  const [parameters, parameterContext] = emitForwardingParameterAsts(
    member.parameters,
    currentContext,
    emitTypeAst
  );
  currentContext = parameterContext;
  const memberName = emitCSharpName(
    member.overloadFamily?.publicName ?? member.name,
    "methods",
    currentContext
  );

  return [
    {
      kind: "methodDeclaration",
      attributes: [],
      modifiers: [],
      returnType: returnTypeAst,
      name: memberName,
      explicitInterface: explicitInterfaceTypeAst,
      typeParameters: member.typeParameters?.map((typeParameter) => ({
        name: escapeCSharpIdentifier(typeParameter.name),
      })),
      parameters,
      expressionBody: {
        kind: "invocationExpression",
        expression: interfaceMemberAccessExpression(
          explicitInterfaceTypeAst,
          memberName
        ),
        arguments: parameters.map(parameterReferenceExpression),
      },
    },
    {
      ...currentContext,
      typeParameters: context.typeParameters,
    },
  ];
};

const buildCommonInterfaceCarrierMembers = (
  members: readonly IrType[],
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [
  {
    readonly implementedInterfaceTypeAsts: readonly CSharpTypeAst[];
    readonly forwardedInterfaceMembers: readonly CSharpMemberAst[];
  },
  EmitterContext,
] => {
  const contracts = intersectCommonNativeInterfaceContracts(members, context);
  if (contracts.length === 0) {
    return [
      { implementedInterfaceTypeAsts: [], forwardedInterfaceMembers: [] },
      context,
    ];
  }

  const cache = getCommonInterfaceCarrierMembersCache(context);
  const cacheKey = contracts.map((contract) => contract.key).join("|");
  const cached = cache.get(cacheKey);
  if (cached) {
    return [cached, context];
  }

  let currentContext = context;
  const implementedInterfaceTypeAsts: CSharpTypeAst[] = [];
  const forwardedMembersByKey = new Map<string, CSharpMemberAst>();

  for (const contract of contracts) {
    const [interfaceTypeAst, interfaceTypeContext] = emitTypeAst(
      contract.ref,
      currentContext
    );
    currentContext = interfaceTypeContext;
    implementedInterfaceTypeAsts.push(interfaceTypeAst);

    for (const entry of collectEffectiveInterfaceMemberEntries(
      contract.info,
      currentContext,
      contract.ref
    )) {
      const declaringType = entry.declaringType ?? contract.ref;
      const [explicitInterfaceTypeAst, explicitInterfaceContext] = emitTypeAst(
        declaringType,
        currentContext
      );
      currentContext = explicitInterfaceContext;
      const explicitInterfaceName = printType(explicitInterfaceTypeAst)
        .split(".")
        .pop()
        ?.replace(/<.*$/, "");
      const [forwarded, forwardedContext] = buildForwardedInterfaceMember(
        entry.member,
        explicitInterfaceTypeAst,
        explicitInterfaceName ?? declaringType.name,
        currentContext,
        emitTypeAst
      );
      currentContext = forwardedContext;
      const key = [
        stableTypeKeyFromAst(explicitInterfaceTypeAst),
        forwarded.kind,
        forwarded.name,
        memberParameterTypeKey(forwarded),
      ].join("|");
      if (!forwardedMembersByKey.has(key)) {
        forwardedMembersByKey.set(key, forwarded);
      }
    }
  }

  const result = {
    implementedInterfaceTypeAsts,
    forwardedInterfaceMembers: [...forwardedMembersByKey.values()],
  };
  cache.set(cacheKey, result);
  return [result, currentContext];
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
        readonly implementedInterfaceTypeAsts: readonly CSharpTypeAst[];
        readonly forwardedInterfaceMembers: readonly CSharpMemberAst[];
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
                providerQualifiedName: `${layoutSourceType.runtimeCarrierNamespace}.${layoutSourceType.runtimeCarrierName}`,
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

  const [commonInterfaceMembers, commonInterfaceContext] =
    buildCommonInterfaceCarrierMembers(
      definitionFrame.members,
      currentContext,
      emitTypeAst
    );
  currentContext = commonInterfaceContext;

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
      implementedInterfaceTypeAsts:
        commonInterfaceMembers.implementedInterfaceTypeAsts,
      forwardedInterfaceMembers: commonInterfaceMembers.forwardedInterfaceMembers,
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

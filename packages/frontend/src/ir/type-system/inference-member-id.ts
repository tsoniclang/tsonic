/**
 * Member ID Resolution — typeOfMemberId, getIndexerInfo, parseIndexerKeyTypeName
 *
 * Contains member lookup by opaque handle and indexer resolution:
 * - parseIndexerKeyTypeName: extract indexer key provider type from stable ID
 * - getIndexerInfo: resolve indexer property information
 * - typeOfMemberId: member type by opaque handle
 *
 * DAG position: depends on inference-utilities, inference-initializers,
 *               type-system-state, type-system-call-resolution
 */

import type {
  IrType,
  IrFunctionType,
  IrParameter,
  IrReferenceType,
  IrTypeParameter,
} from "../types/index.js";
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsStatementNodes,
  getTstsTypeParameterNodes,
  hasTstsStaticModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import {
  createLocalTypeIdentityState,
  localTypeIdentityKey,
} from "../types/type-ops.js";
import { unknownType } from "./types.js";
import type { MemberId } from "./types.js";
import type { TypeSystemState, Site } from "./type-system-state.js";
import {
  normalizeToNominal,
  resolveTypeIdByName,
} from "./type-system-state.js";
import { parseExternalTypeString } from "./internal/universe/external-type-string-parsing.js";
import { sourcePrimitiveNameToIrType } from "./internal/type-converter/primitives.js";
import {
  attachTypeIds,
  convertTypeNode,
} from "./type-system-call-resolution.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import {
  buildFunctionTypeFromSignatureShape,
  buildCallableOverloadFamilyType,
} from "./inference-utilities.js";
import { tryInferTypeFromInitializer } from "./inference-initializers.js";

const indexerInstantiationTypeKeyState = createLocalTypeIdentityState();

const isTstsNode = (node: unknown): node is TstsNode =>
  typeof node === "object" && node !== null && "Kind" in node;

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const indexerInstantiationTypeArgKey = (type: IrType): string =>
  localTypeIdentityKey(type, indexerInstantiationTypeKeyState);

const convertMethodTypeParameters = (
  state: TypeSystemState,
  typeParameters: readonly TstsNode[] | undefined,
  applySubstitution: (type: IrType) => IrType
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => {
    const data = TstsSyntax.AsTypeParameterDeclaration(typeParameter);
    const constraint = data?.Constraint;
    const defaultType = data?.DefaultType;
    return {
      kind: "typeParameter",
      name: getTstsNodeNameText(typeParameter) ?? "T",
      constraint: constraint
        ? applySubstitution(convertTypeNode(state, constraint))
        : undefined,
      default: defaultType
        ? applySubstitution(convertTypeNode(state, defaultType))
        : undefined,
      variance: undefined,
      isStructuralConstraint: constraint?.Kind === TstsSyntax.KindTypeLiteral,
      structuralMembers: undefined,
    };
  });
};

export const parseIndexerKeyTypeName = (
  stableId: string
): string | undefined => {
  const memberSep = stableId.indexOf("::");
  if (memberSep < 0) return undefined;

  const bracketStart = stableId.indexOf("[", memberSep);
  if (bracketStart < 0) return undefined;

  let depth = 0;
  let bracketEnd = -1;
  for (let i = bracketStart; i < stableId.length; i++) {
    const ch = stableId[i];
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        bracketEnd = i;
        break;
      }
    }
  }
  if (bracketEnd < 0) return undefined;

  const rawParams = stableId.slice(bracketStart + 1, bracketEnd);

  // Split on top-level commas to support nested generic types.
  const splitTopLevel = (value: string): string[] => {
    const parts: string[] = [];
    let start = 0;
    let bracketDepth = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (c === "[") bracketDepth++;
      else if (c === "]" && bracketDepth > 0) bracketDepth--;
      else if (c === "," && bracketDepth === 0) {
        parts.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(value.slice(start).trim());
    return parts.filter((p) => p.length > 0);
  };

  const params = splitTopLevel(rawParams);
  if (params.length !== 1) return undefined;

  const first = params[0];
  if (!first) return undefined;

  const withoutProviderSuffix = first.includes(",")
    ? (first.split(",")[0] ?? first)
    : first;
  return withoutProviderSuffix.trim();
};

const resolveIndexerKeyIrType = (
  state: TypeSystemState,
  keyTypeName: string
): IrType => {
  const targetTypeId = state.unifiedCatalog.resolveProviderName(keyTypeName);
  const targetEntry = targetTypeId
    ? state.unifiedCatalog.getByTypeId(targetTypeId)
    : undefined;
  if (targetEntry?.sourcePrimitiveName) {
    return sourcePrimitiveNameToIrType(targetEntry.sourcePrimitiveName);
  }

  const parsed = parseExternalTypeString(keyTypeName);
  if (parsed.kind !== "referenceType") {
    return parsed;
  }

  const typeId =
    (parsed.providerQualifiedName
      ? state.unifiedCatalog.resolveProviderName(parsed.providerQualifiedName)
      : undefined) ??
    state.unifiedCatalog.resolveProviderName(parsed.name) ??
    state.unifiedCatalog.resolveTsName(parsed.name);
  if (!typeId) {
    return parsed;
  }

  const entry = state.unifiedCatalog.getByTypeId(typeId);
  if (entry?.sourcePrimitiveName) {
    return sourcePrimitiveNameToIrType(entry.sourcePrimitiveName);
  }

  return { ...parsed, typeId };
};

export const getIndexerInfo = (
  state: TypeSystemState,
  receiver: IrType,
  _site?: Site
):
  | {
      readonly keyTypeName: string;
      readonly keyType: IrType;
      readonly valueType: IrType;
    }
  | undefined => {
  const normalized = normalizeToNominal(state, receiver);
  if (!normalized) return undefined;

  const buildSubstitutionForTypeArgs = (
    typeId: typeof normalized.typeId,
    typeArgs: readonly IrType[]
  ): ReadonlyMap<string, IrType> => {
    const typeParams = state.unifiedCatalog.getTypeParameters(typeId);
    const subst = new Map<string, IrType>();
    for (let i = 0; i < Math.min(typeParams.length, typeArgs.length); i++) {
      const paramName = typeParams[i]?.name;
      const arg = typeArgs[i];
      if (paramName && arg) {
        subst.set(paramName, arg);
      }
    }
    return subst;
  };

  const resolveInstantiatedDeclaringType = (
    targetTypeId: typeof normalized.typeId
  ):
    | {
        readonly substitution: ReadonlyMap<string, IrType>;
        readonly typeArgs: readonly IrType[];
      }
    | undefined => {
    type SearchState = {
      readonly typeId: typeof normalized.typeId;
      readonly typeArgs: readonly IrType[];
    };

    const visited = new Set<string>();
    const queue: SearchState[] = [
      { typeId: normalized.typeId, typeArgs: normalized.typeArgs },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const visitKey = `${current.typeId.stableId}|${current.typeArgs
        .map((arg) => indexerInstantiationTypeArgKey(arg))
        .join(",")}`;
      if (visited.has(visitKey)) {
        continue;
      }
      visited.add(visitKey);

      if (current.typeId.stableId === targetTypeId.stableId) {
        return {
          substitution: buildSubstitutionForTypeArgs(
            current.typeId,
            current.typeArgs
          ),
          typeArgs: current.typeArgs,
        };
      }

      const currentSubstitution = buildSubstitutionForTypeArgs(
        current.typeId,
        current.typeArgs
      );
      const heritage = [...state.unifiedCatalog.getHeritage(current.typeId)].sort(
        (a, b) => {
          const rank = (k: typeof a.kind) => (k === "extends" ? 0 : 1);
          const ra = rank(a.kind);
          const rb = rank(b.kind);
          if (ra !== rb) return ra - rb;
          return a.targetStableId.localeCompare(b.targetStableId);
        }
      );

      for (const edge of heritage) {
        const parentEntry = state.unifiedCatalog.getByStableId(
          edge.targetStableId
        );
        if (!parentEntry) {
          continue;
        }

        const parentTypeArgs = edge.typeArguments.map((arg) =>
          currentSubstitution.size > 0
            ? irSubstitute(arg, currentSubstitution as IrSubstitutionMap)
            : arg
        );
        queue.push({
          typeId: parentEntry.typeId,
          typeArgs: parentTypeArgs,
        });
      }
    }

    return undefined;
  };

  // Walk inheritance chain to find the first indexer property.
  const chain = state.nominalEnv.getInheritanceChain(normalized.typeId);
  for (const typeId of chain) {
    const members = state.unifiedCatalog.getMembers(typeId);
    const indexers = Array.from(members.values()).filter(
      (m) => m.memberKind === "property" && m.isIndexer
    );

    if (indexers.length === 0) continue;
    if (indexers.length > 1) return undefined;

    const indexer = indexers[0];
    if (!indexer?.type) return undefined;

    const keyTypeName = parseIndexerKeyTypeName(indexer.stableId);
    if (!keyTypeName) return undefined;

    const instantiatedDeclaringType = resolveInstantiatedDeclaringType(typeId);
    const nominalInstantiation = state.nominalEnv.getInstantiation(
      normalized.typeId,
      normalized.typeArgs,
      typeId
    );
    const substitution =
      instantiatedDeclaringType?.substitution ??
      nominalInstantiation ??
      new Map<string, IrType>();
    let valueType =
      substitution.size > 0
        ? irSubstitute(indexer.type, substitution as IrSubstitutionMap)
        : indexer.type;
    if (
      valueType.kind === "typeParameterType" &&
      !substitution.has(valueType.name) &&
      instantiatedDeclaringType?.typeArgs.length === 1
    ) {
      const [onlyTypeArg] = instantiatedDeclaringType.typeArgs;
      if (onlyTypeArg) {
        valueType = onlyTypeArg;
      }
    }

    return {
      keyTypeName,
      keyType: resolveIndexerKeyIrType(state, keyTypeName),
      valueType,
    };
  }

  return undefined;
};

// ─────────────────────────────────────────────────────────────────────────
// typeOfMemberId — Get type of member by handle
// ─────────────────────────────────────────────────────────────────────────

export const typeOfMemberId = (
  state: TypeSystemState,
  memberId: MemberId,
  receiverType?: IrType
): IrType => {
  const memberInfo = state.handleRegistry.getMember(memberId);
  if (!memberInfo) {
    return unknownType;
  }

  const requiresExactDeclarationStaticPartition = (() => {
    const decl = isTstsNode(memberInfo.declNode)
      ? memberInfo.declNode
      : undefined;
    if (!decl || !TstsSyntax.IsMethodDeclaration(decl)) {
      return false;
    }

    const parent = decl.Parent;
    if (!parent || !TstsSyntax.IsClassDeclaration(parent)) {
      return false;
    }

    const methodName = tryResolveDeterministicPropertyName(
      TstsSyntax.Node_PropertyNameOrName(decl)
    );
    if (!methodName) {
      return false;
    }

    const staticIntent = hasTstsStaticModifier(decl);
    return concreteTstsNodes(TstsSyntax.Node_Members(parent) ?? []).some(
      (member) =>
        member !== decl &&
        TstsSyntax.IsMethodDeclaration(member) &&
        tryResolveDeterministicPropertyName(
          TstsSyntax.Node_PropertyNameOrName(member)
        ) === methodName &&
        hasTstsStaticModifier(member) !== staticIntent
    );
  })();

  if (receiverType && !requiresExactDeclarationStaticPartition) {
    const normalizedReceiver = normalizeToNominal(state, receiverType);
    if (normalizedReceiver) {
      const lookupResult = state.nominalEnv.findMemberDeclaringType(
        normalizedReceiver.typeId,
        normalizedReceiver.typeArgs,
        memberInfo.name
      );

      if (lookupResult) {
        const catalogMember = state.unifiedCatalog.getMember(
          lookupResult.declaringTypeId,
          memberInfo.name
        );

        if (catalogMember?.type) {
          return attachTypeIds(
            state,
            irSubstitute(
              catalogMember.type,
              lookupResult.substitution as IrSubstitutionMap
            )
          );
        }

        const signatures = catalogMember?.signatures ?? [];
        if (signatures.length > 0) {
          const overloadFamily = buildCallableOverloadFamilyType(
            signatures.map((signature) =>
              buildFunctionTypeFromSignatureShape(
                signature.parameters.map((parameter) => ({
                  name: parameter.name,
                  type: parameter.type,
                  isOptional: parameter.isOptional,
                  isRest: parameter.isRest,
                  mode: parameter.mode,
                })),
                signature.returnType,
                signature.typeParameters.map((typeParameter) => ({
                  kind: "typeParameter" as const,
                  name: typeParameter.name,
                  constraint: typeParameter.constraint
                    ? irSubstitute(
                        typeParameter.constraint,
                        lookupResult.substitution as IrSubstitutionMap
                      )
                    : undefined,
                  default: typeParameter.defaultType
                    ? irSubstitute(
                        typeParameter.defaultType,
                        lookupResult.substitution as IrSubstitutionMap
                      )
                    : undefined,
                }))
              )
            )
          );

          return attachTypeIds(
            state,
            irSubstitute(
              overloadFamily,
              lookupResult.substitution as IrSubstitutionMap
            )
          );
        }
      }
    }
  }

  // Otherwise, attempt to recover type deterministically from the member declaration.
  // This is required for namespace imports (`import * as X`) where members are
  // function declarations / const declarations (no typeNode captured by Binding).
  const decl = isTstsNode(memberInfo.declNode) ? memberInfo.declNode : undefined;
  if (decl) {
    if (
      TstsSyntax.IsEnumMember(decl) &&
      decl.Parent &&
      TstsSyntax.IsEnumDeclaration(decl.Parent)
    ) {
      const enumReceiver =
        receiverType?.kind === "referenceType"
          ? receiverType
          : ({
              kind: "referenceType",
              name: getTstsNodeNameText(decl.Parent) ?? "enum",
            } satisfies IrReferenceType);
      return attachTypeIds(state, enumReceiver);
    }

    const normalizeDeclaringTypeName = (name: string): string =>
      name
        .replace(/\$instance$/, "")
        .replace(/^__(.+)\$views$/, "$1")
        .replace(/_\d+$/, "")
        .replace(/`\d+$/, "");

    const getArrayLikeReceiverReference = (
      type: IrType
    ): IrReferenceType | undefined => {
      if (type.kind === "arrayType") {
        return {
          kind: "referenceType",
          name: "Array",
          typeArguments: [type.elementType],
        };
      }

      if (type.kind === "tupleType") {
        const tupleMembers = type.elementTypes.filter(
          (element): element is IrType => element !== undefined
        );
        const onlyTupleMember = tupleMembers[0];
        const tupleElementType =
          tupleMembers.length === 0
            ? { kind: "unknownType" as const }
            : tupleMembers.length === 1 && onlyTupleMember
              ? onlyTupleMember
              : { kind: "unionType" as const, types: tupleMembers };
        return {
          kind: "referenceType",
          name: "Array",
          typeArguments: [tupleElementType],
        };
      }

      return undefined;
    };

    const declaringNamesCompatible = (
      receiverName: string,
      declaringName: string
    ): boolean => {
      const normalizedReceiver = normalizeDeclaringTypeName(receiverName);
      const normalizedDeclaring = normalizeDeclaringTypeName(declaringName);
      if (normalizedReceiver === normalizedDeclaring) {
        return true;
      }

      return (
        (normalizedReceiver === "Array" &&
          (normalizedDeclaring === "ReadonlyArray" ||
            normalizedDeclaring === "ArrayLike")) ||
        (normalizedReceiver === "ReadonlyArray" &&
          (normalizedDeclaring === "Array" ||
            normalizedDeclaring === "ArrayLike")) ||
        (normalizedReceiver === "ArrayLike" &&
          (normalizedDeclaring === "Array" ||
            normalizedDeclaring === "ReadonlyArray"))
      );
    };

    const getDeclaringTypeSubstitution = ():
      | ReadonlyMap<string, IrType>
      | undefined => {
      if (!receiverType) return undefined;

      const extractReceiverRef = (
        type: IrType
      ): IrReferenceType | undefined => {
        if (type.kind === "referenceType") return type;
        if (type.kind === "intersectionType") {
          return type.types.find(
            (part): part is IrReferenceType => part.kind === "referenceType"
          );
        }
        if (type.kind === "unionType") {
          const nonNullish = type.types.filter(
            (part) =>
              !(
                part.kind === "primitiveType" &&
                (part.name === "null" || part.name === "undefined")
              )
          );
          const onlyNonNullish = nonNullish[0];
          return nonNullish.length === 1 && onlyNonNullish
            ? extractReceiverRef(onlyNonNullish)
            : undefined;
        }
        const arrayLikeRef = getArrayLikeReceiverReference(type);
        if (arrayLikeRef) {
          return arrayLikeRef;
        }
        return undefined;
      };

      const receiverRef = extractReceiverRef(receiverType);
      if (
        !receiverRef?.typeArguments ||
        receiverRef.typeArguments.length === 0
      ) {
        return undefined;
      }

      const parent = decl.Parent;
      const declaringType =
        parent &&
        (TstsSyntax.IsInterfaceDeclaration(parent) ||
          TstsSyntax.IsClassDeclaration(parent))
          ? parent
          : undefined;
      const declaringTypeName = declaringType
        ? getTstsNodeNameText(declaringType)
        : undefined;
      if (!declaringTypeName) {
        return undefined;
      }

      const normalizedReceiver = normalizeToNominal(state, receiverType);
      if (normalizedReceiver) {
        const declaringArity = getTstsTypeParameterNodes(declaringType).length;
        const declaringTypeId =
          resolveTypeIdByName(state, declaringTypeName, declaringArity) ??
          resolveTypeIdByName(state, declaringTypeName);
        if (declaringTypeId) {
          const nominalSubstitution = state.nominalEnv.getInstantiation(
            normalizedReceiver.typeId,
            normalizedReceiver.typeArgs,
            declaringTypeId
          );
          if (nominalSubstitution) {
            return nominalSubstitution;
          }
        }
      }

      const typeParams = concreteTstsNodes(
        getTstsTypeParameterNodes(declaringType)
      );
      if (!typeParams || typeParams.length === 0) {
        return undefined;
      }

      if (
        !declaringNamesCompatible(receiverRef.name, declaringTypeName)
      ) {
        return undefined;
      }

      if (typeParams.length !== receiverRef.typeArguments.length) {
        return undefined;
      }

      const receiverTypeArguments = receiverRef.typeArguments;
      if (!receiverTypeArguments) {
        return undefined;
      }

      const entries: [string, IrType][] = [];
      for (const [index, param] of typeParams.entries()) {
        const arg = receiverTypeArguments[index];
        const paramName = getTstsNodeNameText(param);
        if (!arg) {
          return undefined;
        }
        if (!paramName) {
          return undefined;
        }
        entries.push([paramName, arg]);
      }

      return new Map(entries);
    };

    const substitution = getDeclaringTypeSubstitution();
    const applySubstitution = (type: IrType): IrType =>
      substitution
        ? irSubstitute(type, substitution as IrSubstitutionMap)
        : type;

    const getMethodFamily = ():
      | readonly TstsNode[]
      | undefined => {
      const parent = decl.Parent;

      if (
        parent?.Kind === TstsSyntax.KindSourceFile &&
        TstsSyntax.IsFunctionDeclaration(decl) &&
        getTstsNodeNameText(decl)
      ) {
        const functionName = getTstsNodeNameText(decl);
        const family = concreteTstsNodes(getTstsStatementNodes(parent)).filter(
          (statement) =>
            TstsSyntax.IsFunctionDeclaration(statement) &&
            getTstsNodeNameText(statement) === functionName
        );
        if (family.length === 0) return undefined;
        const overloadSurface = family.filter(
          (member) => TstsSyntax.Node_Body(member) === undefined
        );
        return overloadSurface.length > 0 ? overloadSurface : family;
      }

      if (
        parent &&
        (TstsSyntax.IsClassDeclaration(parent) ||
          TstsSyntax.IsInterfaceDeclaration(parent) ||
          parent.Kind === TstsSyntax.KindTypeLiteral) &&
        (TstsSyntax.IsMethodDeclaration(decl) ||
          TstsSyntax.IsMethodSignatureDeclaration(decl))
      ) {
        const methodName = tryResolveDeterministicPropertyName(
          TstsSyntax.Node_PropertyNameOrName(decl)
        );
        if (!methodName) return undefined;

        const family = concreteTstsNodes(TstsSyntax.Node_Members(parent) ?? []).filter(
          (member) =>
            (TstsSyntax.IsMethodDeclaration(member) ||
              TstsSyntax.IsMethodSignatureDeclaration(member)) &&
            tryResolveDeterministicPropertyName(
              TstsSyntax.Node_PropertyNameOrName(member)
            ) === methodName &&
            (TstsSyntax.IsMethodDeclaration(member) &&
            TstsSyntax.IsMethodDeclaration(decl)
              ? hasTstsStaticModifier(member) === hasTstsStaticModifier(decl)
              : true)
        );
        if (family.length === 0) return undefined;

        const overloadSurface = family.filter(
          (member) =>
            TstsSyntax.IsMethodSignatureDeclaration(member) ||
            (TstsSyntax.IsMethodDeclaration(member) &&
              TstsSyntax.Node_Body(member) === undefined)
        );
        return overloadSurface.length > 0 ? overloadSurface : family;
      }

      return undefined;
    };

    const methodFamily = getMethodFamily();
    if (methodFamily && methodFamily.length > 0) {
      const overloads: IrFunctionType[] = [];
      for (const method of methodFamily) {
        const methodType = getTstsDeclaredTypeNode(method);
        const parameters = concreteTstsNodes(getTstsParameters(method));
        if (!methodType) return unknownType;
        if (parameters.some((parameter) => !getTstsDeclaredTypeNode(parameter))) {
          return unknownType;
        }

        overloads.push(
          buildFunctionTypeFromSignatureShape(
            parameters.map((parameter, index) => ({
              name: getTstsNodeNameText(parameter) ?? `param${index}`,
              type: getTstsDeclaredTypeNode(parameter)
                ? applySubstitution(
                    convertTypeNode(state, getTstsDeclaredTypeNode(parameter))
                  )
                : unknownType,
              isOptional: isTstsOptionalParameter(parameter),
              isRest: isTstsRestParameter(parameter),
              mode: "value",
            })),
            applySubstitution(convertTypeNode(state, methodType)),
            convertMethodTypeParameters(
              state,
              concreteTstsNodes(getTstsTypeParameterNodes(method)),
              applySubstitution
            )
          )
        );
      }

      return buildCallableOverloadFamilyType(overloads);
    }

    // If the member has a type node, convert it with any available declaring-type substitution.
    if (memberInfo.typeNode) {
      return applySubstitution(convertTypeNode(state, memberInfo.typeNode));
    }

    if (TstsSyntax.IsFunctionDeclaration(decl)) {
      // Determinism: require explicit parameter + return annotations.
      const returnTypeNode = getTstsDeclaredTypeNode(decl);
      const parametersNodes = concreteTstsNodes(getTstsParameters(decl));
      if (!returnTypeNode) return unknownType;
      if (parametersNodes.some((p) => getTstsDeclaredTypeNode(p) === undefined)) {
        return unknownType;
      }

      const parameters: readonly IrParameter[] = parametersNodes.map((p) => ({
        kind: "parameter",
        pattern: {
          kind: "identifierPattern",
          name: getTstsNodeNameText(p) ?? "param",
        },
        type: getTstsDeclaredTypeNode(p)
          ? convertTypeNode(state, getTstsDeclaredTypeNode(p))
          : undefined,
        initializer: undefined,
        isOptional: isTstsOptionalParameter(p),
        isRest: isTstsRestParameter(p),
        passing: "value",
      }));

      const returnType = convertTypeNode(state, returnTypeNode);
      const typeParameters = convertMethodTypeParameters(
        state,
        concreteTstsNodes(getTstsTypeParameterNodes(decl)),
        (type) => type
      );
      const fnType: IrFunctionType = {
        kind: "functionType",
        ...(typeParameters ? { typeParameters } : {}),
        parameters,
        returnType,
      };
      return fnType;
    }

    if (TstsSyntax.IsVariableDeclaration(decl)) {
      const typeNode = getTstsDeclaredTypeNode(decl);
      if (typeNode) return convertTypeNode(state, typeNode);
      const inferred = tryInferTypeFromInitializer(state, decl);
      return inferred ?? unknownType;
    }

    if (
      TstsSyntax.IsPropertyDeclaration(decl) ||
      TstsSyntax.IsPropertySignatureDeclaration(decl)
    ) {
      const typeNode = getTstsDeclaredTypeNode(decl);
      if (typeNode)
        return applySubstitution(convertTypeNode(state, typeNode));
      const inferred = tryInferTypeFromInitializer(state, decl);
      return inferred ? applySubstitution(inferred) : unknownType;
    }

    if (TstsSyntax.IsGetAccessorDeclaration(decl)) {
      const typeNode = getTstsDeclaredTypeNode(decl);
      if (typeNode)
        return applySubstitution(convertTypeNode(state, typeNode));
      return unknownType;
    }

    if (TstsSyntax.IsSetAccessorDeclaration(decl)) {
      const setterParam = concreteTstsNodes(getTstsParameters(decl))[0];
      const typeNode = setterParam
        ? getTstsDeclaredTypeNode(setterParam)
        : undefined;
      if (!typeNode) return unknownType;
      return applySubstitution(convertTypeNode(state, typeNode));
    }
  }

  if (memberInfo.typeNode) {
    return convertTypeNode(state, memberInfo.typeNode);
  }

  return unknownType;
};

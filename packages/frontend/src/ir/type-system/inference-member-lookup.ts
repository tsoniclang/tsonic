/**
 * Member Type Lookup — resolveMemberTypeNoDiag, typeOfMember
 *
 * Contains member lookup and resolution logic:
 * - resolveMemberTypeNoDiag: internal member lookup without diagnostics
 * - typeOfMember: public member type query with diagnostics
 *
 * DAG position: depends on inference-utilities,
 *               type-system-state, type-system-relations, type-system-call-resolution
 */

import type {
  IrType,
  IrInterfaceMember,
  IrTypeParameter,
  IrParameter,
  IrFunctionType,
} from "../types/index.js";
import {
  getTstsDeclaredTypeNode,
  getTstsHeritageClauseDetails,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsStatementNodes,
  getTstsTypeParameterNodes,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import {
  buildIrSubstitutionMap,
  substituteIrType as irSubstitute,
} from "../types/ir-substitution.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, Site, MemberRef } from "./type-system-state.js";
import {
  emitDiagnostic,
  normalizeToNominal,
  isNullishPrimitive,
  makeMemberCacheKey,
  resolveTypeIdByName,
} from "./type-system-state.js";
import {
  getSourcePrimitiveAliasName,
  typesEqual,
} from "./type-system-relations.js";
import {
  buildFunctionTypeFromSignatureShape,
  buildCallableOverloadFamilyType,
  buildStructuralMethodFamilyType,
} from "./inference-utilities.js";
import {
  createLocalTypeIdentityState,
  localTypeIdentityKey,
  stableIrTypeKeyIfDeterministic,
  type LocalTypeIdentityState,
} from "../types/type-ops.js";
import {
  convertTypeNode,
  attachTypeIds,
} from "./type-system-call-resolution.js";
import { surfaceIncludesJs } from "../../surface/profiles.js";
import { getSourcePrimitiveFact } from "../../source-frontend/source-primitive-taxonomy.js";
import { expandReferenceAlias } from "./type-alias-expansion.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";

const buildGenericCollectionType = (elementType: IrType): IrType => ({
  kind: "referenceType",
  name: "Iterable",
  typeArguments: [elementType],
});

const FUNCTION_LENGTH_TYPE: IrType = { kind: "primitiveType", name: "int" };

const typeFromCatalogMemberEntry = (
  state: TypeSystemState,
  memberEntry: {
    readonly type?: IrType;
    readonly signatures?: readonly {
      readonly parameters: readonly {
        readonly name: string;
        readonly type: IrType;
        readonly isOptional: boolean;
        readonly isRest: boolean;
        readonly mode?: IrParameter["passing"];
      }[];
      readonly returnType: IrType;
      readonly typeParameters: readonly {
        readonly name: string;
        readonly constraint?: IrType;
        readonly defaultType?: IrType;
      }[];
    }[];
  },
  substitution?: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (memberEntry.type) {
    return attachTypeIds(
      state,
      substitution
        ? irSubstitute(memberEntry.type, substitution)
        : memberEntry.type
    );
  }

  const signatures = memberEntry.signatures ?? [];
  if (signatures.length === 0) {
    return undefined;
  }

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
            ? substitution
              ? irSubstitute(typeParameter.constraint, substitution)
              : typeParameter.constraint
            : undefined,
          default: typeParameter.defaultType
            ? substitution
              ? irSubstitute(typeParameter.defaultType, substitution)
              : typeParameter.defaultType
            : undefined,
        }))
      )
    )
  );

  return attachTypeIds(
    state,
    substitution ? irSubstitute(overloadFamily, substitution) : overloadFamily
  );
};

const resolveFunctionDeclaredMemberType = (
  state: TypeSystemState,
  receiver: IrType,
  memberName: string,
  seen: ReadonlySet<string> = new Set()
): IrType | undefined => {
  if (memberName !== "length") {
    return undefined;
  }

  if (receiver.kind === "functionType") {
    return FUNCTION_LENGTH_TYPE;
  }

  if (
    receiver.kind === "intersectionType" &&
    receiver.types.length > 0 &&
    receiver.types.every((member) => member.kind === "functionType")
  ) {
    return FUNCTION_LENGTH_TYPE;
  }

  if (receiver.kind === "unionType") {
    const functionMembers = receiver.types.filter(
      (member) => !isNullishPrimitive(member)
    );
    if (
      functionMembers.length > 0 &&
      functionMembers.every(
        (member) =>
          resolveFunctionDeclaredMemberType(state, member, memberName, seen) !==
          undefined
      )
    ) {
      return FUNCTION_LENGTH_TYPE;
    }
  }

  if (receiver.kind === "referenceType") {
    const aliasKey = `${receiver.name}:${receiver.typeArguments?.length ?? 0}`;
    if (seen.has(aliasKey)) {
      return undefined;
    }
    const expanded = expandReferenceAlias(state, receiver);
    if (expanded) {
      return resolveFunctionDeclaredMemberType(
        state,
        expanded,
        memberName,
        new Set([...seen, aliasKey])
      );
    }
  }

  return undefined;
};

const resolveDictionaryDeclaredMemberType = (
  receiver: IrType,
  memberName: string
): IrType | undefined => {
  if (receiver.kind !== "dictionaryType") {
    return undefined;
  }

  switch (memberName) {
    case "Count":
      return { kind: "primitiveType", name: "int" };
    case "Keys":
      return buildGenericCollectionType(receiver.keyType);
    case "Values":
      return buildGenericCollectionType(receiver.valueType);
    default:
      return undefined;
  }
};

type AmbientInterfaceLookupTarget = {
  readonly interfaceNames: readonly string[];
  readonly typeArguments: readonly IrType[];
};

const buildAmbientMemberCacheKey = (
  target: AmbientInterfaceLookupTarget,
  memberName: string
): string | undefined => {
  const typeArgumentKeys: string[] = [];
  for (const typeArgument of target.typeArguments) {
    const key = stableIrTypeKeyIfDeterministic(typeArgument);
    if (!key) {
      return undefined;
    }
    typeArgumentKeys.push(key);
  }
  return `${target.interfaceNames.join("|")}<${typeArgumentKeys.join(",")}>::${memberName}`;
};

const getAmbientInterfaceLookupTarget = (
  state: TypeSystemState,
  receiver: IrType
): AmbientInterfaceLookupTarget | undefined => {
  if (!surfaceIncludesJs(state.surfaceCapabilities)) {
    return undefined;
  }

  if (receiver.kind === "arrayType") {
    return {
      interfaceNames: ["Array", "JSArray_1$instance"],
      typeArguments: [receiver.elementType],
    };
  }

  const sourcePrimitiveName = getSourcePrimitiveAliasName(state, receiver);
  if (sourcePrimitiveName === "string" || sourcePrimitiveName === "char") {
    return {
      interfaceNames: ["String"],
      typeArguments: [],
    };
  }
  if (sourcePrimitiveName === "boolean" || sourcePrimitiveName === "bool") {
    return {
      interfaceNames: ["Boolean"],
      typeArguments: [],
    };
  }
  if (sourcePrimitiveName === "bigint") {
    return {
      interfaceNames: ["BigInt"],
      typeArguments: [],
    };
  }

  const sourcePrimitiveFact = sourcePrimitiveName
    ? getSourcePrimitiveFact(sourcePrimitiveName)
    : undefined;
  if (
    sourcePrimitiveName === "number" ||
    sourcePrimitiveFact?.runtimeBase === "number"
  ) {
    return {
      interfaceNames: ["Number"],
      typeArguments: [],
    };
  }
  if (sourcePrimitiveFact?.runtimeBase === "bigint") {
    return {
      interfaceNames: ["BigInt"],
      typeArguments: [],
    };
  }

  if (receiver.kind !== "referenceType") {
    return undefined;
  }

  if (receiver.name === "Array" || receiver.name === "ReadonlyArray") {
    return {
      interfaceNames: [receiver.name],
      typeArguments: receiver.typeArguments ?? [],
    };
  }

  if (receiver.name === "ArrayConstructor") {
    return {
      interfaceNames: ["ArrayConstructor"],
      typeArguments: [],
    };
  }

  if (
    receiver.name === "StringConstructor" ||
    receiver.name === "NumberConstructor" ||
    receiver.name === "BooleanConstructor" ||
    receiver.name === "BigIntConstructor"
  ) {
    return {
      interfaceNames: [receiver.name],
      typeArguments: [],
    };
  }

  return undefined;
};

const definedTstsNodes = (
  nodes: readonly (TstsNode | undefined)[] | undefined
): readonly TstsNode[] =>
  (nodes ?? []).filter((node): node is TstsNode => node !== undefined);

const resolveStructuralMemberType = (
  members: readonly IrInterfaceMember[],
  memberName: string
): IrType | undefined => {
  const matchingMembers = members.filter(
    (member) => member.name === memberName
  );
  if (matchingMembers.length === 0) {
    return undefined;
  }

  const propertyMembers = matchingMembers.filter(
    (
      member
    ): member is Extract<IrInterfaceMember, { kind: "propertySignature" }> =>
      member.kind === "propertySignature"
  );
  if (propertyMembers.length > 0) {
    const [property] = propertyMembers;
    if (!property) {
      return undefined;
    }

    if (!property.isOptional) {
      return property.type;
    }

    return {
      kind: "unionType",
      types: [property.type, { kind: "primitiveType", name: "undefined" }],
    };
  }

  const methodMembers = matchingMembers.filter(
    (
      member
    ): member is Extract<IrInterfaceMember, { kind: "methodSignature" }> =>
      member.kind === "methodSignature"
  );
  return buildStructuralMethodFamilyType(methodMembers);
};

const resolveReferenceStructuralMemberType = (
  state: TypeSystemState,
  receiver: Extract<IrType, { kind: "referenceType" }>,
  memberName: string
): IrType | undefined => {
  if (!receiver.structuralMembers || receiver.structuralMembers.length === 0) {
    return undefined;
  }

  const memberType = resolveStructuralMemberType(
    receiver.structuralMembers,
    memberName
  );
  if (!memberType) {
    return undefined;
  }

  const normalized = normalizeToNominal(state, receiver);
  if (!normalized) {
    return memberType;
  }

  const formalTypeParameters = state.unifiedCatalog
    .getTypeParameters(normalized.typeId)
    .map((typeParameter) => typeParameter.name);
  const substitution = buildIrSubstitutionMap(
    { ...receiver, typeArguments: normalized.typeArgs },
    formalTypeParameters
  );
  return substitution ? irSubstitute(memberType, substitution) : memberType;
};

const collectAmbientInterfaceDeclarations = (
  statements: readonly TstsNode[],
  interfaceName: string,
  sink: TstsNode[]
): void => {
  for (const statement of statements) {
    if (
      TstsSyntax.IsInterfaceDeclaration(statement) &&
      getTstsNodeNameText(statement) === interfaceName
    ) {
      sink.push(statement);
      continue;
    }

    if (!TstsSyntax.IsModuleDeclaration(statement)) {
      continue;
    }

    let currentBody = TstsSyntax.Node_Body(statement);
    while (currentBody) {
      if (TstsSyntax.IsModuleBlock(currentBody)) {
        collectAmbientInterfaceDeclarations(
          definedTstsNodes(TstsSyntax.Node_Statements(currentBody)),
          interfaceName,
          sink
        );
        break;
      }

      if (TstsSyntax.IsModuleDeclaration(currentBody)) {
        currentBody = TstsSyntax.Node_Body(currentBody);
        continue;
      }

      break;
    }
  }
};

const getAmbientInterfaceDeclarations = (
  state: TypeSystemState,
  interfaceName: string
): readonly TstsNode[] => {
  const cached = state.ambientInterfaceDeclarationCache.get(interfaceName);
  if (cached !== undefined) {
    return cached;
  }

  const declarations: TstsNode[] = [];
  for (const sourceFile of state.sourceFilesByPath.values()) {
    collectAmbientInterfaceDeclarations(
      definedTstsNodes(getTstsStatementNodes(sourceFile)),
      interfaceName,
      declarations
    );
  }
  state.ambientInterfaceDeclarationCache.set(interfaceName, declarations);
  return declarations;
};

const buildAmbientTypeParameterSubstitution = (
  typeParameters: readonly TstsNode[] | undefined,
  typeArguments: readonly IrType[]
): ReadonlyMap<string, IrType> | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const entries: [string, IrType][] = [];
  for (const [index, typeParameter] of typeParameters.entries()) {
    const typeArgument = typeArguments[index];
    const typeParameterName = getTstsNodeNameText(typeParameter);
    if (!typeArgument) {
      return undefined;
    }
    if (!typeParameterName) {
      return undefined;
    }
    entries.push([typeParameterName, typeArgument]);
  }

  return new Map(entries);
};

const applyAmbientSubstitution = (
  type: IrType,
  substitution: ReadonlyMap<string, IrType> | undefined
): IrType =>
  substitution && substitution.size > 0
    ? irSubstitute(type, substitution)
    : type;

const convertAmbientMethodTypeParameters = (
  state: TypeSystemState,
  typeParameters: readonly TstsNode[] | undefined,
  substitution: ReadonlyMap<string, IrType> | undefined
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => ({
    kind: "typeParameter",
    name: getTstsNodeNameText(typeParameter) ?? "_",
    constraint: TstsSyntax.AsTypeParameterDeclaration(typeParameter)?.Constraint
      ? applyAmbientSubstitution(
          convertTypeNode(
            state,
            TstsSyntax.AsTypeParameterDeclaration(typeParameter)!.Constraint!
          ),
          substitution
        )
      : undefined,
    default: TstsSyntax.AsTypeParameterDeclaration(typeParameter)?.DefaultType
      ? applyAmbientSubstitution(
          convertTypeNode(
            state,
            TstsSyntax.AsTypeParameterDeclaration(typeParameter)!.DefaultType!
          ),
          substitution
        )
      : undefined,
    variance: undefined,
    isStructuralConstraint:
      !!TstsSyntax.AsTypeParameterDeclaration(typeParameter)?.Constraint &&
      TstsSyntax.IsTypeLiteralNode(
        TstsSyntax.AsTypeParameterDeclaration(typeParameter)!.Constraint!
      ),
    structuralMembers: undefined,
  }));
};

const convertAmbientParameter = (
  state: TypeSystemState,
  parameter: TstsNode,
  substitution: ReadonlyMap<string, IrType> | undefined,
  index: number
): IrParameter => ({
  kind: "parameter",
  pattern: {
    kind: "identifierPattern",
    name: getTstsNodeNameText(parameter) ?? `param${index}`,
  },
  type: getTstsDeclaredTypeNode(parameter)
    ? applyAmbientSubstitution(
        convertTypeNode(state, getTstsDeclaredTypeNode(parameter)!),
        substitution
      )
    : undefined,
  initializer: undefined,
  isOptional:
    TstsSyntax.Node_QuestionToken(parameter) !== undefined ||
    TstsSyntax.Node_Initializer(parameter) !== undefined,
  isRest:
    TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined,
  passing: "value",
});

const flattenCallableAmbientType = (
  type: IrType
): readonly IrFunctionType[] => {
  if (type.kind === "functionType") {
    return [type];
  }

  if (type.kind === "intersectionType") {
    const flattened = type.types.flatMap((part) =>
      flattenCallableAmbientType(part)
    );
    return flattened.length === type.types.length ? flattened : [];
  }

  return [];
};

const isUnknownMemberType = (type: IrType): boolean =>
  type.kind === "unknownType";

const hasStructuralMemberSurface = (type: IrType): boolean =>
  type.kind === "objectType" ||
  (type.kind === "referenceType" &&
    type.structuralMembers !== undefined &&
    type.structuralMembers.length > 0);

const selectIntersectionMemberType = (
  resolvedParts: readonly IrType[]
): IrType | undefined => {
  const knownParts = resolvedParts.filter(
    (part) => !isUnknownMemberType(part)
  );
  const memberParts = knownParts.length > 0 ? knownParts : resolvedParts;

  if (memberParts.length === 1) {
    return memberParts[0];
  }

  const callableParts = memberParts.flatMap(flattenCallableAmbientType);
  if (callableParts.length > 0 && callableParts.length === memberParts.length) {
    return buildCallableOverloadFamilyType(callableParts);
  }

  const [first] = memberParts;
  if (
    first &&
    memberParts.length > 1 &&
    memberParts.every((part) => typesEqual(part, first))
  ) {
    return first;
  }

  return undefined;
};

const combineUnionMemberTypes = (
  state: TypeSystemState,
  memberTypes: readonly IrType[]
): IrType | undefined => {
  const distinctTypes: IrType[] = [];
  for (const memberType of memberTypes) {
    if (
      !distinctTypes.some((existingType) =>
        typesEqual(existingType, memberType)
      )
    ) {
      distinctTypes.push(memberType);
    }
  }

  const [onlyType] = distinctTypes;
  if (distinctTypes.length === 1 && onlyType) {
    return attachTypeIds(state, onlyType);
  }

  return distinctTypes.length > 0
    ? attachTypeIds(state, {
        kind: "unionType",
        types: distinctTypes,
      })
    : undefined;
};

const lookupAmbientInterfaceMember = (
  state: TypeSystemState,
  target: AmbientInterfaceLookupTarget,
  memberName: string
): IrType | undefined => {
  const propertyResults: IrType[] = [];
  const methodResults: Extract<
    IrInterfaceMember,
    { kind: "methodSignature" }
  >[] = [];
  const inheritedResults: IrType[] = [];

  for (const interfaceName of target.interfaceNames) {
    for (const statement of getAmbientInterfaceDeclarations(state, interfaceName)) {
      const substitution = buildAmbientTypeParameterSubstitution(
        definedTstsNodes(getTstsTypeParameterNodes(statement)),
        target.typeArguments
      );
      let matchedDirectMember = false;

      for (const member of definedTstsNodes(getTstsMemberNodes(statement))) {
        if (tryResolveDeterministicPropertyName(TstsSyntax.Node_Name(member)) !== memberName) {
          continue;
        }
        matchedDirectMember = true;

        if (TstsSyntax.IsPropertySignatureDeclaration(member)) {
          const memberType = getTstsDeclaredTypeNode(member);
          const propertyType = memberType
            ? applyAmbientSubstitution(
                convertTypeNode(state, memberType),
                substitution
              )
            : unknownType;
          propertyResults.push(
            TstsSyntax.Node_QuestionToken(member) !== undefined
              ? {
                  kind: "unionType",
                  types: [
                    propertyType,
                    { kind: "primitiveType", name: "undefined" },
                  ],
                }
              : propertyType
          );
          continue;
        }

        if (!TstsSyntax.IsMethodSignatureDeclaration(member)) {
          continue;
        }

        const returnTypeNode = getTstsDeclaredTypeNode(member);
        const returnType = returnTypeNode
          ? TstsSyntax.IsTypePredicateNode(returnTypeNode)
            ? ({ kind: "primitiveType", name: "boolean" } as const)
            : applyAmbientSubstitution(
                convertTypeNode(state, returnTypeNode),
                substitution
              )
          : undefined;

        methodResults.push({
          kind: "methodSignature",
          name: memberName,
          typeParameters: convertAmbientMethodTypeParameters(
            state,
            definedTstsNodes(getTstsTypeParameterNodes(member)),
            substitution
          ),
          parameters: definedTstsNodes(getTstsParameters(member)).map((parameter, index) =>
            convertAmbientParameter(state, parameter, substitution, index)
          ),
          returnType,
        });
      }

      if (matchedDirectMember) {
        continue;
      }

      for (const clause of getTstsHeritageClauseDetails(statement)) {
        if (clause.kind !== "extends") continue;
        for (const heritageType of definedTstsNodes(clause.types)) {
          const inheritedType = applyAmbientSubstitution(
            convertTypeNode(state, heritageType),
            substitution
          );
          const inheritedMember = resolveMemberTypeNoDiag(
            state,
            inheritedType,
            memberName
          );
          if (inheritedMember) {
            inheritedResults.push(inheritedMember);
          }
        }
      }
    }
  }

  if (propertyResults.length > 0) {
    const [only] = propertyResults;
    if (propertyResults.length === 1 && only) {
      return attachTypeIds(state, only);
    }

    if (
      only &&
      propertyResults.every((propertyType) => typesEqual(propertyType, only))
    ) {
      return attachTypeIds(state, only);
    }

    return undefined;
  }

  const callableResults: IrFunctionType[] = [];
  const directMethodFamily = buildStructuralMethodFamilyType(methodResults);
  if (directMethodFamily) {
    callableResults.push(...flattenCallableAmbientType(directMethodFamily));
  }
  for (const inheritedResult of inheritedResults) {
    callableResults.push(...flattenCallableAmbientType(inheritedResult));
  }

  if (callableResults.length > 0) {
    const [only] = callableResults;
    const methodFamily =
      callableResults.length === 1 && only
        ? only
        : buildCallableOverloadFamilyType(callableResults);
    return methodFamily ? attachTypeIds(state, methodFamily) : undefined;
  }

  const [onlyInherited] = inheritedResults;
  if (inheritedResults.length === 1 && onlyInherited) {
    return attachTypeIds(state, onlyInherited);
  }

  if (
    onlyInherited &&
    inheritedResults.every((inheritedType) =>
      typesEqual(inheritedType, onlyInherited)
    )
  ) {
    return attachTypeIds(state, onlyInherited);
  }

  return undefined;
};

export const resolveMemberTypeNoDiag = (
  state: TypeSystemState,
  receiver: IrType,
  memberName: string,
  seenAliasExpansions: ReadonlySet<string> = new Set(),
  aliasIdentityState: LocalTypeIdentityState = createLocalTypeIdentityState()
): IrType | undefined => {
  const functionDeclaredMemberType = resolveFunctionDeclaredMemberType(
    state,
    receiver,
    memberName
  );
  if (functionDeclaredMemberType) {
    return functionDeclaredMemberType;
  }

  const dictionaryDeclaredMemberType = resolveDictionaryDeclaredMemberType(
    receiver,
    memberName
  );
  if (dictionaryDeclaredMemberType) {
    return dictionaryDeclaredMemberType;
  }

  if (receiver.kind === "referenceType") {
    const expandedAlias = expandReferenceAlias(state, receiver);
    if (expandedAlias) {
      const aliasKey = `${localTypeIdentityKey(
        receiver,
        aliasIdentityState
      )}::${memberName}`;
      if (!seenAliasExpansions.has(aliasKey)) {
        const aliasMemberType = resolveMemberTypeNoDiag(
          state,
          expandedAlias,
          memberName,
          new Set([...seenAliasExpansions, aliasKey]),
          aliasIdentityState
        );
        if (aliasMemberType) {
          return aliasMemberType;
        }
      }
    }
  }

  if (receiver.kind === "unionType") {
    const nonNullish = receiver.types.filter(
      (member) => !isNullishPrimitive(member)
    );
    const memberTypes: IrType[] = [];
    for (const part of nonNullish) {
      const memberType = resolveMemberTypeNoDiag(
        state,
        part,
        memberName,
        seenAliasExpansions,
        aliasIdentityState
      );
      if (!memberType) {
        return undefined;
      }
      memberTypes.push(memberType);
    }
    return combineUnionMemberTypes(state, memberTypes);
  }

  if (receiver.kind === "intersectionType") {
    const resolveFromParts = (parts: readonly IrType[]): IrType | undefined =>
      selectIntersectionMemberType(
        parts
          .map((part) =>
            resolveMemberTypeNoDiag(
              state,
              part,
              memberName,
              seenAliasExpansions,
              aliasIdentityState
            )
          )
          .filter((part): part is IrType => part !== undefined)
      );

    const structuralMember = resolveFromParts(
      receiver.types.filter(hasStructuralMemberSurface)
    );
    if (structuralMember) {
      return structuralMember;
    }

    return resolveFromParts(receiver.types);
  }

  if (
    receiver.kind === "referenceType" &&
    receiver.structuralMembers &&
    receiver.structuralMembers.length > 0
  ) {
    const structuralMember = resolveReferenceStructuralMemberType(
      state,
      receiver,
      memberName
    );
    if (structuralMember) {
      return structuralMember;
    }
  }

  const ambientTarget = getAmbientInterfaceLookupTarget(state, receiver);
  if (ambientTarget) {
    const ambientCacheKey = buildAmbientMemberCacheKey(
      ambientTarget,
      memberName
    );
    const cachedAmbientMember = ambientCacheKey
      ? state.ambientMemberLookupCache.get(ambientCacheKey)
      : undefined;
    let ambientMember =
      cachedAmbientMember === undefined
        ? undefined
        : cachedAmbientMember ?? undefined;
    if (cachedAmbientMember === undefined) {
      if (ambientCacheKey) {
        state.ambientMemberLookupCache.set(ambientCacheKey, null);
      }
      ambientMember = lookupAmbientInterfaceMember(
        state,
        ambientTarget,
        memberName
      );
      if (ambientCacheKey) {
        state.ambientMemberLookupCache.set(
          ambientCacheKey,
          ambientMember ?? null
        );
      }
    }
    if (ambientMember) {
      return ambientMember;
    }
  }

  // 1. Normalize receiver to nominal form
  const normalized = normalizeToNominal(state, receiver);
  if (!normalized) {
    // Handle structural types (objectType)
    if (receiver.kind === "objectType") {
      return resolveStructuralMemberType(receiver.members, memberName);
    }

    if (
      receiver.kind === "referenceType" &&
      receiver.structuralMembers &&
      receiver.structuralMembers.length > 0
    ) {
      return resolveReferenceStructuralMemberType(state, receiver, memberName);
    }
    return undefined;
  }

  // 2. Check cache
  const cacheKey = makeMemberCacheKey(
    normalized.typeId.stableId,
    memberName,
    normalized.typeArgs
  );
  const cached = state.memberDeclaredTypeCache.get(cacheKey);
  if (cached) return cached;

  // 3. Use NominalEnv to find declaring type and TypeId-based substitution.
  const lookupResult = state.nominalEnv.findMemberDeclaringType(
    normalized.typeId,
    normalized.typeArgs,
    memberName
  );

  // 4a. If NominalEnv found the member, get its declared type from Universe
  if (lookupResult) {
    const memberEntry = state.unifiedCatalog.getMember(
      lookupResult.declaringTypeId,
      memberName
    );

    const result = memberEntry
      ? typeFromCatalogMemberEntry(
          state,
          memberEntry,
          lookupResult.substitution
        )
      : undefined;
    if (result) {
      state.memberDeclaredTypeCache.set(cacheKey, result);
      return result;
    }
  }
  return undefined;
};

export const typeOfExternalBoundMember = (
  state: TypeSystemState,
  member: {
    readonly ownerIdentity: string;
    readonly type: string;
    readonly member: string;
  }
): IrType | undefined => {
  const stableEntry = state.unifiedCatalog.getByStableId(
    `${member.ownerIdentity}:${member.type}`
  );
  const typeId =
    stableEntry?.typeId ??
    resolveTypeIdByName(state, member.type) ??
    state.unifiedCatalog.resolveProviderName(member.type);
  if (!typeId) {
    return undefined;
  }

  const lookupResult = state.nominalEnv.findMemberDeclaringType(
    typeId,
    [],
    member.member
  );
  if (lookupResult) {
    const catalogMember = state.unifiedCatalog.getMember(
      lookupResult.declaringTypeId,
      member.member
    );
    return catalogMember
      ? typeFromCatalogMemberEntry(
          state,
          catalogMember,
          lookupResult.substitution
        )
      : undefined;
  }

  const catalogMember = state.unifiedCatalog.getMember(typeId, member.member);
  return catalogMember
    ? typeFromCatalogMemberEntry(state, catalogMember)
    : undefined;
};

export const typeOfMember = (
  state: TypeSystemState,
  receiver: IrType,
  member: MemberRef,
  site?: Site
): IrType => {
  const memberName = member.kind === "byName" ? member.name : "unknown"; // MemberId.name not defined yet

  // Common nullish unions (T | undefined | null) should behave like T for member lookup.
  // This preserves deterministic typing for patterns like:
  //   const url = request.url; if (!url) return; url.absolutePath
  const effectiveReceiver =
    receiver.kind === "unionType"
      ? (() => {
          const nonNullish = receiver.types.filter(
            (t) => t && !isNullishPrimitive(t)
          );
          return nonNullish.length === 1 && nonNullish[0]
            ? nonNullish[0]
            : receiver;
        })()
      : receiver;

  if (effectiveReceiver.kind === "unionType") {
    const nonNullish = effectiveReceiver.types.filter(
      (t) => t && !isNullishPrimitive(t)
    );

    if (nonNullish.length > 1) {
      const partTypes: IrType[] = [];
      for (const part of nonNullish) {
        const partType = resolveMemberTypeNoDiag(state, part, memberName);
        if (!partType) {
          emitDiagnostic(
            state,
            "TSN5203",
            `Member '${memberName}' not found`,
            site
          );
          return unknownType;
        }
        partTypes.push(partType);
      }

      const unionMemberType = combineUnionMemberTypes(state, partTypes);
      if (unionMemberType) return unionMemberType;
    }
  }

  const resolved = resolveMemberTypeNoDiag(
    state,
    effectiveReceiver,
    memberName
  );
  if (resolved) return resolved;

  emitDiagnostic(state, "TSN5203", `Member '${memberName}' not found`, site);
  return unknownType;
};

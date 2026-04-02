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
import * as ts from "typescript";
import { substituteIrType as irSubstitute } from "../types/ir-substitution.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, Site, MemberRef } from "./type-system-state.js";
import {
  emitDiagnostic,
  normalizeToNominal,
  isNullishPrimitive,
  makeMemberCacheKey,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import {
  buildFunctionTypeFromSignatureShape,
  buildCallableOverloadFamilyType,
  buildStructuralMethodFamilyType,
} from "./inference-utilities.js";
import { convertTypeNode, attachTypeIds } from "./type-system-call-resolution.js";

const getAmbientInterfaceLookupTarget = (
  receiver: IrType
):
  | {
      readonly interfaceNames: readonly string[];
      readonly typeArguments: readonly IrType[];
    }
  | undefined => {
  if (receiver.kind === "arrayType") {
    return {
      interfaceNames: ["Array", "JSArray_1$instance"],
      typeArguments: [receiver.elementType],
    };
  }

  if (receiver.kind === "tupleType") {
    const tupleMembers = receiver.elementTypes.filter(
      (element): element is IrType => element !== undefined
    );
    const onlyTupleMember = tupleMembers[0];
    return {
      interfaceNames: ["Array", "JSArray_1$instance"],
      typeArguments: [
        tupleMembers.length === 0
          ? { kind: "unknownType" }
          : tupleMembers.length === 1 && onlyTupleMember
            ? onlyTupleMember
            : { kind: "unionType", types: tupleMembers },
      ],
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

  return undefined;
};

const getTypeElementName = (name: ts.PropertyName | undefined): string | undefined => {
  if (!name) {
    return undefined;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
};

const resolveStructuralMemberType = (
  members: readonly IrInterfaceMember[],
  memberName: string
): IrType | undefined => {
  const matchingMembers = members.filter((member) => member.name === memberName);
  if (matchingMembers.length === 0) {
    return undefined;
  }

  const propertyMembers = matchingMembers.filter(
    (
      member
    ): member is Extract<
      IrInterfaceMember,
      { kind: "propertySignature" }
    > => member.kind === "propertySignature"
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

const collectAmbientInterfaceDeclarations = (
  statements: readonly ts.Statement[],
  interfaceName: string,
  sink: ts.InterfaceDeclaration[]
): void => {
  for (const statement of statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName) {
      sink.push(statement);
      continue;
    }

    if (!ts.isModuleDeclaration(statement)) {
      continue;
    }

    let currentBody: ts.ModuleBody | undefined = statement.body;
    while (currentBody) {
      if (ts.isModuleBlock(currentBody)) {
        collectAmbientInterfaceDeclarations(
          currentBody.statements,
          interfaceName,
          sink
        );
        break;
      }

      if (ts.isModuleDeclaration(currentBody)) {
        currentBody = currentBody.body;
        continue;
      }

      break;
    }
  }
};

const buildAmbientTypeParameterSubstitution = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined,
  typeArguments: readonly IrType[]
): ReadonlyMap<string, IrType> | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const entries: [string, IrType][] = [];
  for (const [index, typeParameter] of typeParameters.entries()) {
    const typeArgument = typeArguments[index];
    if (!typeArgument) {
      return undefined;
    }
    entries.push([typeParameter.name.text, typeArgument]);
  }

  return new Map(entries);
};

const applyAmbientSubstitution = (
  type: IrType,
  substitution: ReadonlyMap<string, IrType> | undefined
): IrType =>
  substitution && substitution.size > 0 ? irSubstitute(type, substitution) : type;

const convertAmbientMethodTypeParameters = (
  state: TypeSystemState,
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined,
  substitution: ReadonlyMap<string, IrType> | undefined
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => ({
    kind: "typeParameter",
    name: typeParameter.name.text,
    constraint: typeParameter.constraint
      ? applyAmbientSubstitution(
          convertTypeNode(state, typeParameter.constraint),
          substitution
        )
      : undefined,
    default: typeParameter.default
      ? applyAmbientSubstitution(
          convertTypeNode(state, typeParameter.default),
          substitution
        )
      : undefined,
    variance: undefined,
    isStructuralConstraint:
      !!typeParameter.constraint && ts.isTypeLiteralNode(typeParameter.constraint),
    structuralMembers: undefined,
  }));
};

const convertAmbientParameter = (
  state: TypeSystemState,
  parameter: ts.ParameterDeclaration,
  substitution: ReadonlyMap<string, IrType> | undefined,
  index: number
): IrParameter => ({
  kind: "parameter",
  pattern: {
    kind: "identifierPattern",
    name: ts.isIdentifier(parameter.name) ? parameter.name.text : `param${index}`,
  },
  type: parameter.type
    ? applyAmbientSubstitution(convertTypeNode(state, parameter.type), substitution)
    : undefined,
  initializer: undefined,
  isOptional: !!parameter.questionToken || !!parameter.initializer,
  isRest: !!parameter.dotDotDotToken,
  passing: "value",
});

const flattenCallableAmbientType = (
  type: IrType
): readonly IrFunctionType[] => {
  if (type.kind === "functionType") {
    return [type];
  }

  if (type.kind === "intersectionType") {
    const flattened = type.types.flatMap((part) => flattenCallableAmbientType(part));
    return flattened.length === type.types.length ? flattened : [];
  }

  return [];
};

const getArrayRuntimeElementType = (receiver: IrType): IrType | undefined => {
  if (receiver.kind === "arrayType") {
    return receiver.elementType;
  }

  if (receiver.kind === "tupleType") {
    const tupleMembers = receiver.elementTypes.filter(
      (element): element is IrType => element !== undefined
    );
    const onlyTupleMember = tupleMembers[0];
    if (tupleMembers.length === 0) {
      return { kind: "unknownType" };
    }
    if (tupleMembers.length === 1 && onlyTupleMember) {
      return onlyTupleMember;
    }
    return { kind: "unionType", types: tupleMembers };
  }

  return undefined;
};

const makeValueParameter = (
  name: string,
  type: IrType,
  isOptional: boolean = false
): IrParameter => ({
  kind: "parameter",
  pattern: {
    kind: "identifierPattern",
    name,
  },
  type,
  initializer: undefined,
  isOptional,
  isRest: false,
  passing: "value",
});

const STRING_IR_TYPE: IrType = { kind: "primitiveType", name: "string" };
const INT_IR_TYPE: IrType = { kind: "primitiveType", name: "int" };

const lookupJsStringRuntimeMember = (
  memberName: string
): IrType | undefined => {
  if (
    memberName === "Length" ||
    memberName === "Count" ||
    memberName === "length"
  ) {
    return INT_IR_TYPE;
  }

  if (
    memberName === "charCodeAt" ||
    memberName === "codePointAt"
  ) {
    return {
      kind: "functionType",
      parameters: [makeValueParameter("index", INT_IR_TYPE)],
      returnType: INT_IR_TYPE,
    };
  }

  if (
    memberName === "indexOf" ||
    memberName === "lastIndexOf"
  ) {
    return {
      kind: "functionType",
      parameters: [
        makeValueParameter("searchString", STRING_IR_TYPE),
        makeValueParameter("position", INT_IR_TYPE, true),
      ],
      returnType: INT_IR_TYPE,
    };
  }

  if (memberName === "search" || memberName === "localeCompare") {
    return {
      kind: "functionType",
      parameters: [makeValueParameter("value", STRING_IR_TYPE)],
      returnType: INT_IR_TYPE,
    };
  }

  return undefined;
};

const lookupJsArrayRuntimeMember = (
  state: TypeSystemState,
  receiver: IrType,
  memberName: string
): IrType | undefined => {
  const elementType = getArrayRuntimeElementType(receiver);
  if (!elementType) {
    return undefined;
  }

  const runtimeTypeId =
    state.unifiedCatalog.resolveClrName("Tsonic.Runtime.JSArray`1") ??
    state.unifiedCatalog.resolveTsName("JSArray_1");
  if (!runtimeTypeId) {
    return undefined;
  }

  const runtimeMember = state.unifiedCatalog.getMember(runtimeTypeId, memberName);
  if (!runtimeMember) {
    return undefined;
  }

  const typeParameters = state.unifiedCatalog.getTypeParameters(runtimeTypeId);
  const substitution =
    typeParameters.length === 0
      ? undefined
      : new Map<string, IrType>(
          typeParameters.map((typeParameter, index) => [
            typeParameter.name,
            index === 0 ? elementType : ({ kind: "unknownType" } as IrType),
          ])
        );

  const memberType = runtimeMember.type;
  if (memberType) {
    return attachTypeIds(
      state,
      substitution ? irSubstitute(memberType, substitution) : memberType
    );
  }

  const signatures = runtimeMember.signatures ?? [];
  if (signatures.length === 0) {
    return undefined;
  }

  const overloadFamily = buildCallableOverloadFamilyType(
    signatures.map((signature) =>
      buildFunctionTypeFromSignatureShape(
        signature.parameters.map((parameter) => ({
          name: parameter.name,
          type:
            substitution && substitution.size > 0
              ? irSubstitute(parameter.type, substitution)
              : parameter.type,
          isOptional: parameter.isOptional,
          isRest: parameter.isRest,
          mode: parameter.mode,
        })),
        substitution && substitution.size > 0
          ? irSubstitute(signature.returnType, substitution)
          : signature.returnType,
        signature.typeParameters.map((typeParameter) => ({
          kind: "typeParameter" as const,
          name: typeParameter.name,
          constraint: typeParameter.constraint
            ? substitution && substitution.size > 0
              ? irSubstitute(typeParameter.constraint, substitution)
              : typeParameter.constraint
            : undefined,
          default: typeParameter.defaultType
            ? substitution && substitution.size > 0
              ? irSubstitute(typeParameter.defaultType, substitution)
              : typeParameter.defaultType
            : undefined,
        }))
      )
    )
  );

  return attachTypeIds(state, overloadFamily);
};

const lookupAmbientInterfaceMember = (
  state: TypeSystemState,
  receiver: IrType,
  memberName: string
): IrType | undefined => {
  const target = getAmbientInterfaceLookupTarget(receiver);
  if (!target) {
    return undefined;
  }

  const propertyResults: IrType[] = [];
  const methodResults: Extract<IrInterfaceMember, { kind: "methodSignature" }>[] = [];
  const inheritedResults: IrType[] = [];

  for (const sourceFile of state.sourceFilesByPath.values()) {
    const declarations: ts.InterfaceDeclaration[] = [];
    for (const interfaceName of target.interfaceNames) {
      collectAmbientInterfaceDeclarations(
        sourceFile.statements,
        interfaceName,
        declarations
      );
    }

    for (const statement of declarations) {
      const substitution = buildAmbientTypeParameterSubstitution(
        statement.typeParameters,
        target.typeArguments
      );
      let matchedDirectMember = false;

      for (const member of statement.members) {
        if (getTypeElementName(member.name) !== memberName) {
          continue;
        }
        matchedDirectMember = true;

        if (ts.isPropertySignature(member)) {
          const propertyType = member.type
            ? applyAmbientSubstitution(convertTypeNode(state, member.type), substitution)
            : unknownType;
          propertyResults.push(
            member.questionToken
              ? {
                  kind: "unionType",
                  types: [propertyType, { kind: "primitiveType", name: "undefined" }],
                }
              : propertyType
          );
          continue;
        }

        if (!ts.isMethodSignature(member)) {
          continue;
        }

        const returnType = member.type
          ? ts.isTypePredicateNode(member.type)
            ? ({ kind: "primitiveType", name: "boolean" } as const)
            : applyAmbientSubstitution(convertTypeNode(state, member.type), substitution)
          : undefined;

        methodResults.push({
          kind: "methodSignature",
          name: memberName,
          typeParameters: convertAmbientMethodTypeParameters(
            state,
            member.typeParameters,
            substitution
          ),
          parameters: member.parameters.map((parameter, index) =>
            convertAmbientParameter(state, parameter, substitution, index)
          ),
          returnType,
        });
      }

      if (matchedDirectMember) {
        continue;
      }

      const extendsClause = statement.heritageClauses?.find(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
      );
      for (const heritageType of extendsClause?.types ?? []) {
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
    inheritedResults.every((inheritedType) => typesEqual(inheritedType, onlyInherited))
  ) {
    return attachTypeIds(state, onlyInherited);
  }

  return undefined;
};

export const resolveMemberTypeNoDiag = (
  state: TypeSystemState,
  receiver: IrType,
  memberName: string
): IrType | undefined => {
  // Built-in dictionary pseudo-members used by TS-side ergonomics.
  // Record<K, V> lowers to dictionaryType, and callers often use:
  // - dict.Keys[i]
  // - dict.Values[i]
  // - dict.Count / dict.Length
  //
  // Resolve these deterministically at TypeSystem level so downstream passes
  // (numeric proof, element access typing) don't receive unknownType poison.
  if (receiver.kind === "dictionaryType") {
    if (memberName === "Keys") {
      return {
        kind: "arrayType",
        elementType: receiver.keyType,
      };
    }
    if (memberName === "Values") {
      return {
        kind: "arrayType",
        elementType: receiver.valueType,
      };
    }
    if (memberName === "Count" || memberName === "Length") {
      return { kind: "primitiveType", name: "int" };
    }

    return receiver.valueType;
  }

  // Built-in array pseudo-members.
  // Arrays are structural IR types and may not resolve via nominal lookup.
  //
  // Support both CLR-style `Length`/`Count` and TS/JS-style `length`.
  // The latter is required for JS surfaces even when the underlying runtime
  // value is an explicit CLR array (for example `Encoding.UTF8.GetBytes(...).length`).
  if (receiver.kind === "arrayType") {
    if (
      memberName === "Length" ||
      memberName === "Count" ||
      memberName === "length"
    ) {
      return { kind: "primitiveType", name: "int" };
    }
  }

  const jsArrayRuntimeMember = lookupJsArrayRuntimeMember(
    state,
    receiver,
    memberName
  );
  if (jsArrayRuntimeMember) {
    return jsArrayRuntimeMember;
  }

  // Tuples behave like fixed-size arrays for length access.
  if (receiver.kind === "tupleType") {
    if (
      memberName === "Length" ||
      memberName === "Count" ||
      memberName === "length"
    ) {
      return { kind: "primitiveType", name: "int" };
    }
  }

  // JavaScript strings expose `.length` as an exact integer at runtime.
  // Preserve that exactness for numeric proof and source-port ergonomics.
  if (receiver.kind === "primitiveType" && receiver.name === "string") {
    const runtimeMember = lookupJsStringRuntimeMember(memberName);
    if (runtimeMember) {
      return runtimeMember;
    }
  }

  if (
    receiver.kind === "referenceType" &&
    receiver.structuralMembers &&
    receiver.structuralMembers.length > 0
  ) {
    const structuralMember = resolveStructuralMemberType(
      receiver.structuralMembers,
      memberName
    );
    if (structuralMember) {
      return structuralMember;
    }
  }

  const ambientMember = lookupAmbientInterfaceMember(state, receiver, memberName);
  if (ambientMember) {
    return ambientMember;
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
      return resolveStructuralMemberType(receiver.structuralMembers, memberName);
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

  // 3. Use NominalEnv to find declaring type + substitution (Phase 6: TypeId-based)
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

    // Property/field member: return its declared type.
    const memberType = memberEntry?.type;
    if (memberType) {
      const result = attachTypeIds(
        state,
        irSubstitute(memberType, lookupResult.substitution)
      );
      state.memberDeclaredTypeCache.set(cacheKey, result);
      return result;
    }

    // Method member: materialize a callable function type from the first signature.
    // Call resolution (resolveCall) uses SignatureId for overload selection; this
    // type is used only to keep member access expressions deterministic.
    const signatures = memberEntry?.signatures ?? [];
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
                    lookupResult.substitution
                  )
                : undefined,
              default: typeParameter.defaultType
                ? irSubstitute(
                    typeParameter.defaultType,
                    lookupResult.substitution
                  )
                : undefined,
            }))
          )
        )
      );

      const result = attachTypeIds(
        state,
        irSubstitute(overloadFamily, lookupResult.substitution)
      );
      state.memberDeclaredTypeCache.set(cacheKey, result);
      return result;
    }
  }
  return undefined;
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
      let resolved: IrType | undefined;
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

        if (!resolved) {
          resolved = partType;
          continue;
        }

        if (!typesEqual(resolved, partType)) {
          emitDiagnostic(
            state,
            "TSN5203",
            `Member '${memberName}' has incompatible types across union constituents`,
            site
          );
          return unknownType;
        }
      }

      if (resolved) return resolved;
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

/**
 * Member Type Resolution — typeOfMember, typeOfMemberId, getIndexerInfo,
 * parseIndexerKeyClrType
 *
 * Contains member lookup and resolution logic:
 * - resolveMemberTypeNoDiag: internal member lookup without diagnostics
 * - typeOfMember: public member type query with diagnostics
 * - typeOfMemberId: member type by opaque handle
 * - parseIndexerKeyClrType: extract indexer key CLR type from stable ID
 * - getIndexerInfo: resolve indexer property information
 *
 * DAG position: depends on inference-utilities, inference-initializers,
 *               type-system-state, type-system-relations, type-system-call-resolution
 */

import type {
  IrType,
  IrFunctionType,
  IrParameter,
  IrReferenceType,
  IrInterfaceMember,
} from "../types/index.js";
import * as ts from "typescript";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import { unknownType } from "./types.js";
import type { MemberId } from "./types.js";
import type { TypeSystemState, Site, MemberRef } from "./type-system-state.js";
import {
  emitDiagnostic,
  normalizeToNominal,
  isNullishPrimitive,
  makeMemberCacheKey,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import {
  attachTypeIds,
  convertTypeNode,
} from "./type-system-call-resolution.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import {
  buildFunctionTypeFromSignatureShape,
  buildCallableOverloadFamilyType,
  buildStructuralMethodFamilyType,
  hasStaticModifier,
} from "./inference-utilities.js";
import { tryInferTypeFromInitializer } from "./inference-initializers.js";

const resolveMemberTypeNoDiag = (
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
    if (
      memberName === "Length" ||
      memberName === "Count" ||
      memberName === "length"
    ) {
      return { kind: "primitiveType", name: "int" };
    }
  }

  // 1. Normalize receiver to nominal form
  const normalized = normalizeToNominal(state, receiver);
  if (!normalized) {
    // Handle structural types (objectType)
    if (receiver.kind === "objectType") {
      const members = receiver.members.filter((m) => m.name === memberName);
      if (members.length === 0) return undefined;

      const propertyMembers = members.filter(
        (
          member
        ): member is Extract<
          IrInterfaceMember,
          { kind: "propertySignature" }
        > => member.kind === "propertySignature"
      );
      if (propertyMembers.length > 0) {
        const [property] = propertyMembers;
        if (!property) return undefined;
        if (!property.isOptional) return property.type;
        return {
          kind: "unionType",
          types: [property.type, { kind: "primitiveType", name: "undefined" }],
        };
      }

      const methodMembers = members.filter(
        (
          member
        ): member is Extract<IrInterfaceMember, { kind: "methodSignature" }> =>
          member.kind === "methodSignature"
      );
      return buildStructuralMethodFamilyType(methodMembers);
    }

    if (
      receiver.kind === "referenceType" &&
      receiver.structuralMembers &&
      receiver.structuralMembers.length > 0
    ) {
      const members = receiver.structuralMembers.filter(
        (m) => m.name === memberName
      );
      if (members.length === 0) return undefined;

      const propertyMembers = members.filter(
        (
          member
        ): member is Extract<
          IrInterfaceMember,
          { kind: "propertySignature" }
        > => member.kind === "propertySignature"
      );
      if (propertyMembers.length > 0) {
        const [property] = propertyMembers;
        if (!property) return undefined;
        if (!property.isOptional) return property.type;
        return {
          kind: "unionType",
          types: [property.type, { kind: "primitiveType", name: "undefined" }],
        };
      }

      const methodMembers = members.filter(
        (
          member
        ): member is Extract<IrInterfaceMember, { kind: "methodSignature" }> =>
          member.kind === "methodSignature"
      );
      return buildStructuralMethodFamilyType(methodMembers);
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
            signature.returnType
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

export const parseIndexerKeyClrType = (
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

  // Strip assembly qualification (", Assembly, Version=..., ...") if present.
  const withoutAsm = first.includes(",")
    ? (first.split(",")[0] ?? first)
    : first;
  return withoutAsm.trim();
};

export const getIndexerInfo = (
  state: TypeSystemState,
  receiver: IrType,
  _site?: Site
): { readonly keyClrType: string; readonly valueType: IrType } | undefined => {
  const normalized = normalizeToNominal(state, receiver);
  if (!normalized) return undefined;

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

    const keyClrType = parseIndexerKeyClrType(indexer.stableId);
    if (!keyClrType) return undefined;

    const inst = state.nominalEnv.getInstantiation(
      normalized.typeId,
      normalized.typeArgs,
      typeId
    );
    const valueType =
      inst && inst.size > 0
        ? irSubstitute(indexer.type, inst as IrSubstitutionMap)
        : indexer.type;

    return { keyClrType, valueType };
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

  // Otherwise, attempt to recover type deterministically from the member declaration.
  // This is required for namespace imports (`import * as X`) where members are
  // function declarations / const declarations (no typeNode captured by Binding).
  const decl = memberInfo.declNode as ts.Declaration | undefined;
  if (decl) {
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

      const parent = decl.parent;
      const declaringType =
        ts.isInterfaceDeclaration(parent) ||
        ts.isClassDeclaration(parent) ||
        ts.isTypeAliasDeclaration(parent)
          ? parent
          : undefined;
      if (!declaringType?.name || !declaringType.typeParameters) {
        return undefined;
      }

      if (
        !declaringNamesCompatible(receiverRef.name, declaringType.name.text)
      ) {
        return undefined;
      }

      const typeParams = declaringType.typeParameters;
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
        if (!arg) {
          return undefined;
        }
        entries.push([param.name.text, arg]);
      }

      return new Map(entries);
    };

    const substitution = getDeclaringTypeSubstitution();
    const applySubstitution = (type: IrType): IrType =>
      substitution
        ? irSubstitute(type, substitution as IrSubstitutionMap)
        : type;

    const getMethodFamily = ():
      | readonly (
          | ts.MethodDeclaration
          | ts.MethodSignature
          | ts.FunctionDeclaration
        )[]
      | undefined => {
      const parent = decl.parent;

      if (
        ts.isSourceFile(parent) &&
        ts.isFunctionDeclaration(decl) &&
        decl.name
      ) {
        const family = parent.statements.filter(
          (statement): statement is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(statement) &&
            statement.name?.text === decl.name?.text
        );
        if (family.length === 0) return undefined;
        const overloadSurface = family.filter((member) => !member.body);
        return overloadSurface.length > 0 ? overloadSurface : family;
      }

      if (
        (ts.isClassDeclaration(parent) ||
          ts.isInterfaceDeclaration(parent) ||
          ts.isTypeLiteralNode(parent)) &&
        (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl))
      ) {
        const methodName = tryResolveDeterministicPropertyName(decl.name);
        if (!methodName) return undefined;

        const family = parent.members.filter(
          (member): member is ts.MethodDeclaration | ts.MethodSignature =>
            (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) &&
            tryResolveDeterministicPropertyName(member.name) === methodName &&
            (ts.isMethodDeclaration(member) && ts.isMethodDeclaration(decl)
              ? hasStaticModifier(member) === hasStaticModifier(decl)
              : true)
        );
        if (family.length === 0) return undefined;

        const overloadSurface = family.filter(
          (member) =>
            ts.isMethodSignature(member) ||
            (ts.isMethodDeclaration(member) && !member.body)
        );
        return overloadSurface.length > 0 ? overloadSurface : family;
      }

      return undefined;
    };

    const methodFamily = getMethodFamily();
    if (methodFamily && methodFamily.length > 0) {
      const overloads: IrFunctionType[] = [];
      for (const method of methodFamily) {
        if (!method.type) return unknownType;
        if (
          method.parameters.some((parameter) => parameter.type === undefined)
        ) {
          return unknownType;
        }

        overloads.push(
          buildFunctionTypeFromSignatureShape(
            method.parameters.map((parameter, index) => ({
              name: ts.isIdentifier(parameter.name)
                ? parameter.name.text
                : `param${index}`,
              type: parameter.type
                ? applySubstitution(convertTypeNode(state, parameter.type))
                : unknownType,
              isOptional: !!parameter.questionToken || !!parameter.initializer,
              isRest: !!parameter.dotDotDotToken,
              mode: "value",
            })),
            applySubstitution(convertTypeNode(state, method.type))
          )
        );
      }

      return buildCallableOverloadFamilyType(overloads);
    }

    // If the member has a type node, convert it with any available declaring-type substitution.
    if (memberInfo.typeNode) {
      return applySubstitution(convertTypeNode(state, memberInfo.typeNode));
    }

    if (ts.isFunctionDeclaration(decl)) {
      // Determinism: require explicit parameter + return annotations.
      if (!decl.type) return unknownType;
      if (decl.parameters.some((p) => p.type === undefined)) return unknownType;

      const parameters: readonly IrParameter[] = decl.parameters.map((p) => ({
        kind: "parameter",
        pattern: {
          kind: "identifierPattern",
          name: ts.isIdentifier(p.name) ? p.name.text : "param",
        },
        type: p.type ? convertTypeNode(state, p.type) : undefined,
        initializer: undefined,
        isOptional: !!p.questionToken || !!p.initializer,
        isRest: !!p.dotDotDotToken,
        passing: "value",
      }));

      const returnType = convertTypeNode(state, decl.type);
      const fnType: IrFunctionType = {
        kind: "functionType",
        parameters,
        returnType,
      };
      return fnType;
    }

    if (ts.isVariableDeclaration(decl)) {
      if (decl.type) return convertTypeNode(state, decl.type);
      const inferred = tryInferTypeFromInitializer(state, decl);
      return inferred ?? unknownType;
    }
  }

  if (memberInfo.typeNode) {
    return convertTypeNode(state, memberInfo.typeNode);
  }

  return unknownType;
};

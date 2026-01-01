/**
 * TypeSystem Core Implementation
 *
 * Implements the TypeSystem interface using TypeRegistry, NominalEnv,
 * and HandleRegistry. This is the single source of truth for all type queries.
 *
 * INVARIANT INV-0: No ts.Type or computed type APIs are used here.
 * All type information comes from:
 * 1. HandleRegistry (declaration TypeNodes from Binding layer)
 * 2. TypeRegistry (nominal type declarations)
 * 3. NominalEnv (inheritance chain + substitution)
 */

import type ts from "typescript";
import type { Binding } from "../binding/index.js";
import type {
  IrType,
  IrReferenceType,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
} from "../types/index.js";
import { substituteIrType, typesEqual } from "../types/index.js";
import type { TypeRegistry } from "../type-registry.js";
import type {
  NominalEnv,
  ConvertTypeFn,
  InstantiationEnv,
} from "../nominal-env.js";
import type {
  TypeSystem,
  HandleRegistry,
  DeclId,
  SignatureId,
  MemberId,
  TypeResult,
  SignatureResult,
  MemberResult,
  PropertyInit,
  SyntaxPosition,
  TypeSubstitution,
  UtilityTypeName,
  ParameterType,
  TypeParameterInfo,
} from "./index.js";
import {
  typeOk,
  typeError,
  signatureOk,
  unknownType,
  voidType,
} from "./types.js";
import { createDiagnostic } from "../../types/diagnostic.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE SYSTEM FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeSystemConfig {
  readonly registry: TypeRegistry;
  readonly nominalEnv: NominalEnv;
  readonly handleRegistry: HandleRegistry;
  readonly convertTypeNode: ConvertTypeFn;
  readonly binding: Binding;
}

/**
 * Create a TypeSystem instance.
 */
export const createTypeSystem = (config: TypeSystemConfig): TypeSystem => {
  const { registry, nominalEnv, handleRegistry, convertTypeNode, binding } =
    config;

  // ─────────────────────────────────────────────────────────────────────────
  // CORE QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  const getDeclType = (decl: DeclId): TypeResult => {
    const info = handleRegistry.getDecl(decl);
    if (!info) {
      return typeError([
        createDiagnostic("TSN5203", "error", "Cannot resolve declaration type"),
      ]);
    }

    // If we have an explicit type annotation, convert it
    if (info.typeNode) {
      const irType = convertTypeNode(info.typeNode as ts.TypeNode, binding);
      return typeOk(irType);
    }

    // For declarations without explicit type, return unknownType with diagnostic
    return typeError([
      createDiagnostic(
        "TSN5201",
        "error",
        `Declaration '${info.fqName ?? "unknown"}' requires explicit type annotation`
      ),
    ]);
  };

  const getSignature = (sig: SignatureId): SignatureResult => {
    const info = handleRegistry.getSignature(sig);
    if (!info) {
      return {
        parameters: [],
        returnType: unknownType,
        diagnostics: [
          createDiagnostic("TSN5203", "error", "Cannot resolve signature"),
        ],
      };
    }

    // Convert parameters
    const parameters: ParameterType[] = info.parameters.map((p) => ({
      name: p.name,
      type: p.typeNode
        ? convertTypeNode(p.typeNode as ts.TypeNode, binding)
        : unknownType,
      isOptional: p.isOptional,
      isRest: p.isRest,
    }));

    // Convert return type
    const returnType = info.returnTypeNode
      ? convertTypeNode(info.returnTypeNode as ts.TypeNode, binding)
      : voidType;

    // Convert type parameters
    const typeParameters: TypeParameterInfo[] | undefined =
      info.typeParameters?.map((tp) => ({
        name: tp.name,
        constraint: tp.constraintNode
          ? convertTypeNode(tp.constraintNode as ts.TypeNode, binding)
          : undefined,
        defaultType: tp.defaultNode
          ? convertTypeNode(tp.defaultNode as ts.TypeNode, binding)
          : undefined,
      }));

    return signatureOk(parameters, returnType, typeParameters);
  };

  const getMemberType = (_type: IrType, member: MemberId): TypeResult => {
    const info = handleRegistry.getMember(member);
    if (!info) {
      return typeError([
        createDiagnostic(
          "TSN5203",
          "error",
          `Cannot resolve member '${member.name}'`
        ),
      ]);
    }

    if (!info.typeNode) {
      return typeError([
        createDiagnostic(
          "TSN5201",
          "error",
          `Member '${member.name}' requires explicit type annotation`
        ),
      ]);
    }

    const irType = convertTypeNode(info.typeNode as ts.TypeNode, binding);
    return typeOk(irType);
  };

  const instantiate = (type: IrType, args: readonly IrType[]): TypeResult => {
    if (type.kind !== "referenceType") {
      return typeOk(type); // Non-reference types don't have type parameters
    }

    // Look up the type in registry to get its type parameters
    const entry = registry.resolveBySimpleName(type.name);
    if (!entry) {
      // Type not in registry - just attach type arguments
      return typeOk({
        ...type,
        typeArguments: args,
      });
    }

    // Build substitution map
    const subst = new Map<string, IrType>();
    entry.typeParameters.forEach((param, i) => {
      const arg = args[i];
      if (arg !== undefined) {
        subst.set(param, arg);
      }
    });

    // Substitute in structural members if present
    const substitutedMembers = type.structuralMembers?.map((m) =>
      substituteIrMember(m, subst)
    );

    return typeOk({
      ...type,
      typeArguments: args,
      structuralMembers: substitutedMembers,
    });
  };

  const getExpectedType = (_position: SyntaxPosition): TypeResult => {
    // This is a simplified implementation
    // The full implementation would walk up the AST to find contextual type
    // For now, return unknownType - the actual implementation is in helpers.ts
    return typeOk(unknownType);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY TYPE EXPANSION
  // ─────────────────────────────────────────────────────────────────────────

  const expandUtilityType = (
    utilityName: UtilityTypeName,
    typeArgs: readonly IrType[],
    _sourceTypeArgs?: unknown
  ): TypeResult => {
    const firstArg = typeArgs[0];
    if (!firstArg) {
      return typeError([
        createDiagnostic(
          "TSN7414",
          "error",
          `Utility type '${utilityName}' requires a type argument`
        ),
      ]);
    }

    switch (utilityName) {
      case "NonNullable":
        return expandNonNullable(firstArg);

      case "Partial":
      case "Required":
      case "Readonly":
        return expandMappedUtility(utilityName, firstArg);

      default:
        return typeError([
          createDiagnostic(
            "TSN7414",
            "error",
            `Utility type '${utilityName}' expansion not yet implemented in TypeSystem`
          ),
        ]);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STRUCTURAL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  const getStructuralMembers = (type: IrType): readonly MemberResult[] => {
    if (type.kind === "objectType") {
      return type.members.map((m) => memberToResult(m, type));
    }

    if (type.kind === "referenceType" && type.structuralMembers) {
      return type.structuralMembers.map((m) => memberToResult(m, type));
    }

    if (type.kind === "referenceType") {
      // Look up in registry and get members
      const entry = registry.resolveBySimpleName(type.name);
      if (!entry) return [];

      const members: MemberResult[] = [];
      entry.members.forEach((info, name) => {
        if (info.kind === "property" && info.typeNode) {
          const memberType = convertTypeNode(info.typeNode, binding);
          members.push({
            name,
            type: memberType,
            isOptional: info.isOptional,
            isReadonly: info.isReadonly,
            declaringType: type,
          });
        }
      });

      // Include inherited members via NominalEnv
      const fqName = registry.getFQName(type.name);
      if (fqName) {
        const chain = nominalEnv.getInheritanceChain(fqName);
        for (const parentFqName of chain.slice(1)) {
          const parentEntry = registry.resolveNominal(parentFqName);
          if (!parentEntry) continue;

          // Get substitution for this parent
          const subst = nominalEnv.getInstantiation(
            fqName,
            type.typeArguments ?? [],
            parentFqName
          );

          parentEntry.members.forEach((info, name) => {
            // Skip if already have this member (child overrides)
            if (members.some((m) => m.name === name)) return;

            if (info.kind === "property" && info.typeNode) {
              const rawType = convertTypeNode(info.typeNode, binding);
              const memberType = subst
                ? substituteIrType(rawType, subst)
                : rawType;
              members.push({
                name,
                type: memberType,
                isOptional: info.isOptional,
                isReadonly: info.isReadonly,
                declaringType: {
                  kind: "referenceType",
                  name: parentEntry.name,
                },
              });
            }
          });
        }
      }

      return members;
    }

    return [];
  };

  const resolvePropertyAccess = (
    type: IrType,
    propertyName: string
  ): TypeResult => {
    // Handle arrays
    if (type.kind === "arrayType") {
      if (propertyName === "length") {
        return typeOk({ kind: "primitiveType", name: "int" });
      }
      return typeError([
        createDiagnostic(
          "TSN5203",
          "error",
          `Property '${propertyName}' not found on array type`
        ),
      ]);
    }

    // Handle tuples
    if (type.kind === "tupleType") {
      const index = parseInt(propertyName, 10);
      const element = type.elementTypes[index];
      if (!isNaN(index) && index >= 0 && element !== undefined) {
        return typeOk(element);
      }
      if (propertyName === "length") {
        return typeOk({
          kind: "literalType",
          value: type.elementTypes.length,
        });
      }
    }

    // Handle objects and references
    const members = getStructuralMembers(type);
    const member = members.find((m) => m.name === propertyName);
    if (member) {
      return typeOk(member.type);
    }

    return typeError([
      createDiagnostic(
        "TSN5203",
        "error",
        `Property '${propertyName}' not found on type`
      ),
    ]);
  };

  const synthesizeObjectType = (
    properties: readonly PropertyInit[]
  ): TypeResult => {
    const members: IrInterfaceMember[] = properties.map((p) => ({
      kind: "propertySignature" as const,
      name: p.name,
      type: p.value,
      isOptional: p.isOptional ?? false,
      isReadonly: false,
    }));

    return typeOk({
      kind: "objectType",
      members,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SUBSTITUTION & INHERITANCE
  // ─────────────────────────────────────────────────────────────────────────

  const substitute = (
    type: IrType,
    substitutions: TypeSubstitution
  ): IrType => {
    return substituteIrType(type, substitutions);
  };

  const getInheritanceChain = (type: IrReferenceType): readonly IrType[] => {
    const fqName = registry.getFQName(type.name);
    if (!fqName) return [type];

    const chain = nominalEnv.getInheritanceChain(fqName);
    return chain.map((name) => {
      const entry = registry.resolveNominal(name);
      return {
        kind: "referenceType" as const,
        name: entry?.name ?? name,
      };
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TYPE COMPARISON
  // ─────────────────────────────────────────────────────────────────────────

  const typesEqualFn = (a: IrType, b: IrType): boolean => {
    return typesEqual(a, b);
  };

  const isAssignableTo = (source: IrType, target: IrType): boolean => {
    // Simple structural check for now
    if (typesEqual(source, target)) return true;

    // any is assignable to anything
    if (source.kind === "anyType") return true;

    // anything is assignable to any
    if (target.kind === "anyType") return true;

    // unknown accepts anything
    if (target.kind === "unknownType") return true;

    // null/undefined assignable to optional types
    if (source.kind === "primitiveType") {
      if (source.name === "null" || source.name === "undefined") {
        if (target.kind === "unionType") {
          return target.types.some(
            (t) =>
              t.kind === "primitiveType" &&
              (t.name === "null" || t.name === "undefined")
          );
        }
      }
    }

    // TODO: More complex subtype checks
    return false;
  };

  return {
    getDeclType,
    getSignature,
    getMemberType,
    instantiate,
    getExpectedType,
    expandUtilityType,
    getStructuralMembers,
    resolvePropertyAccess,
    synthesizeObjectType,
    substitute,
    getInheritanceChain,
    typesEqual: typesEqualFn,
    isAssignableTo,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const substituteIrMember = (
  member: IrInterfaceMember,
  subst: InstantiationEnv
): IrInterfaceMember => {
  if (member.kind === "propertySignature") {
    return {
      ...member,
      type: substituteIrType(member.type, subst),
    };
  }
  if (member.kind === "methodSignature") {
    return {
      ...member,
      parameters: member.parameters.map((p) => ({
        ...p,
        type: p.type ? substituteIrType(p.type, subst) : undefined,
      })),
      returnType: member.returnType
        ? substituteIrType(member.returnType, subst)
        : undefined,
    };
  }
  return member;
};

const memberToResult = (
  member: IrInterfaceMember,
  declaringType: IrType
): MemberResult => {
  if (member.kind === "propertySignature") {
    return {
      name: member.name,
      type: member.type,
      isOptional: member.isOptional,
      isReadonly: member.isReadonly,
      declaringType,
    };
  }
  // Method signature
  return {
    name: member.name,
    type: getFunctionTypeForMethod(member),
    isOptional: false,
    isReadonly: false,
    declaringType,
  };
};

const getFunctionTypeForMethod = (method: IrMethodSignature): IrType => {
  return {
    kind: "functionType",
    parameters: method.parameters.map((p) => ({
      kind: "parameter" as const,
      pattern: {
        kind: "identifierPattern" as const,
        name: getParameterName(p),
      },
      type: p.type,
      isOptional: p.isOptional,
      isRest: p.isRest,
      passing: p.passing,
    })),
    returnType: method.returnType ?? voidType,
  };
};

const getParameterName = (p: {
  readonly pattern: { readonly kind: string; readonly name?: string };
}): string => {
  if (p.pattern.kind === "identifierPattern" && p.pattern.name) {
    return p.pattern.name;
  }
  return "param";
};

// ─────────────────────────────────────────────────────────────────────────
// UTILITY TYPE HELPERS
// ─────────────────────────────────────────────────────────────────────────

const expandNonNullable = (type: IrType): TypeResult => {
  if (type.kind !== "unionType") {
    // Not a union, check if it's null/undefined directly
    if (type.kind === "primitiveType") {
      if (type.name === "null" || type.name === "undefined") {
        return typeOk({ kind: "neverType" });
      }
    }
    return typeOk(type);
  }

  // Filter out null and undefined from union
  const filtered = type.types.filter((t) => {
    if (t.kind === "primitiveType") {
      return t.name !== "null" && t.name !== "undefined";
    }
    return true;
  });

  if (filtered.length === 0) {
    return typeOk({ kind: "neverType" });
  }
  const first = filtered[0];
  if (filtered.length === 1 && first !== undefined) {
    return typeOk(first);
  }
  return typeOk({ kind: "unionType", types: filtered });
};

const expandMappedUtility = (
  utilityName: "Partial" | "Required" | "Readonly",
  type: IrType
): TypeResult => {
  // Only works on object/reference types
  if (type.kind !== "objectType" && type.kind !== "referenceType") {
    return typeError([
      createDiagnostic(
        "TSN7414",
        "error",
        `${utilityName} requires an object type argument`
      ),
    ]);
  }

  // For reference types without structural members, we can't expand
  if (type.kind === "referenceType" && !type.structuralMembers) {
    return typeError([
      createDiagnostic(
        "TSN7414",
        "error",
        `${utilityName} requires a concrete object type, not a type parameter`
      ),
    ]);
  }

  const members: readonly IrInterfaceMember[] =
    type.kind === "objectType" ? type.members : (type.structuralMembers ?? []);

  const transformedMembers: IrInterfaceMember[] = members.map((m) => {
    if (m.kind !== "propertySignature") return m;
    const prop = m as IrPropertySignature;
    return {
      ...prop,
      isOptional:
        utilityName === "Partial"
          ? true
          : utilityName === "Required"
            ? false
            : prop.isOptional,
      isReadonly: utilityName === "Readonly" ? true : prop.isReadonly,
    };
  });

  return typeOk({
    kind: "objectType",
    members: transformedMembers,
  });
};

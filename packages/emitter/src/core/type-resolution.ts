/**
 * Type resolution helpers for generic null/default handling
 *
 * Provides:
 * - containsTypeParameter: Check if type contains any type parameter
 * - substituteTypeArgs: Substitute type arguments into a type
 * - getPropertyType: Look up property type from contextual type
 * - stripNullish: Remove null/undefined from union types
 * - isDefinitelyValueType: Check if type is a C# value type
 */

import type {
  IrType,
  IrInterfaceMember,
  IrClassMember,
  IrPropertySignature, // NEW: needed for union-member matching
} from "@tsonic/frontend";
import type { LocalTypeInfo, EmitterContext } from "../types.js";

/**
 * Check if a type contains any type parameter.
 *
 * Uses both:
 * 1. IR kind "typeParameterType" (explicit type parameter node)
 * 2. Name matching via typeParams set (for referenceType nodes)
 *
 * @param type - The IR type to check
 * @param typeParams - Set of type parameter names in current scope
 * @returns true if the type contains a type parameter
 */
export const containsTypeParameter = (
  type: IrType,
  typeParams: ReadonlySet<string>
): boolean => {
  switch (type.kind) {
    case "typeParameterType":
      // New IR kind - always a type parameter
      return true;

    case "referenceType":
      // Check if this referenceType is actually a type parameter
      if (typeParams.has(type.name)) {
        return true;
      }
      // Recurse into type arguments
      if (type.typeArguments) {
        return type.typeArguments.some((arg) =>
          containsTypeParameter(arg, typeParams)
        );
      }
      return false;

    case "arrayType":
      return containsTypeParameter(type.elementType, typeParams);

    case "dictionaryType":
      return (
        containsTypeParameter(type.keyType, typeParams) ||
        containsTypeParameter(type.valueType, typeParams)
      );

    case "unionType":
    case "intersectionType":
      return type.types.some((t) => containsTypeParameter(t, typeParams));

    case "tupleType":
      return type.elementTypes.some((t) =>
        containsTypeParameter(t, typeParams)
      );

    case "functionType":
      if (containsTypeParameter(type.returnType, typeParams)) {
        return true;
      }
      return type.parameters.some(
        (p) => p.type && containsTypeParameter(p.type, typeParams)
      );

    case "objectType":
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsTypeParameter(m.type, typeParams);
        }
        if (m.kind === "methodSignature") {
          if (m.returnType && containsTypeParameter(m.returnType, typeParams)) {
            return true;
          }
          return m.parameters.some(
            (p) => p.type && containsTypeParameter(p.type, typeParams)
          );
        }
        return false;
      });

    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return false;

    default: {
      // Exhaustive check - this will error if a new IR type kind is added
      const exhaustive: never = type;
      void exhaustive;
      return false;
    }
  }
};

/**
 * Substitute type arguments into a type.
 *
 * @param type - The type to substitute into
 * @param typeParamNames - List of type parameter names (in order)
 * @param typeArgs - List of type arguments (in order, parallel to typeParamNames)
 * @returns The type with type parameters substituted
 */
export const substituteTypeArgs = (
  type: IrType,
  typeParamNames: readonly string[],
  typeArgs: readonly IrType[]
): IrType => {
  // Build mapping from name to type
  const mapping = new Map<string, IrType>();
  for (let i = 0; i < typeParamNames.length && i < typeArgs.length; i++) {
    const name = typeParamNames[i];
    const arg = typeArgs[i];
    if (name !== undefined && arg !== undefined) {
      mapping.set(name, arg);
    }
  }

  return substituteType(type, mapping);
};

/**
 * Internal helper for type substitution
 */
const substituteType = (
  type: IrType,
  mapping: ReadonlyMap<string, IrType>
): IrType => {
  switch (type.kind) {
    case "typeParameterType": {
      const substitution = mapping.get(type.name);
      return substitution ?? type;
    }

    case "referenceType": {
      // Check if this referenceType is actually a type parameter
      const substitution = mapping.get(type.name);
      if (substitution && !type.typeArguments) {
        return substitution;
      }
      // Recurse into type arguments
      if (type.typeArguments) {
        return {
          ...type,
          typeArguments: type.typeArguments.map((arg) =>
            substituteType(arg, mapping)
          ),
        };
      }
      return type;
    }

    case "arrayType":
      return {
        ...type,
        elementType: substituteType(type.elementType, mapping),
      };

    case "dictionaryType":
      return {
        ...type,
        keyType: substituteType(type.keyType, mapping),
        valueType: substituteType(type.valueType, mapping),
      };

    case "unionType":
      return {
        ...type,
        types: type.types.map((t) => substituteType(t, mapping)),
      };

    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map((t) => substituteType(t, mapping)),
      };

    case "intersectionType":
      return {
        ...type,
        types: type.types.map((t) => substituteType(t, mapping)),
      };

    case "functionType":
      return {
        ...type,
        returnType: substituteType(type.returnType, mapping),
        parameters: type.parameters.map((p) =>
          p.type ? { ...p, type: substituteType(p.type, mapping) } : p
        ),
      };

    case "objectType":
      return {
        ...type,
        members: type.members.map((m) => {
          if (m.kind === "propertySignature") {
            return { ...m, type: substituteType(m.type, mapping) };
          }
          if (m.kind === "methodSignature") {
            return {
              ...m,
              returnType: m.returnType
                ? substituteType(m.returnType, mapping)
                : undefined,
              parameters: m.parameters.map((p) =>
                p.type ? { ...p, type: substituteType(p.type, mapping) } : p
              ),
            };
          }
          return m;
        }),
      };

    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return type;

    default: {
      const exhaustive: never = type;
      void exhaustive;
      return type;
    }
  }
};

/**
 * Look up property type from a contextual type.
 *
 * This handles:
 * - Local types (class/interface/typeAlias) via localTypes map
 * - Type alias chasing (follows alias.type until reaching a concrete type)
 * - Interface extends resolution (searches base interfaces)
 * - Generic type argument substitution
 *
 * @param contextualType - The contextual type (e.g., Result<T>)
 * @param propertyName - The property name to look up
 * @param context - Emitter context with localTypes
 * @returns The property type after substitution, or undefined if not found
 */
export const getPropertyType = (
  contextualType: IrType | undefined,
  propertyName: string,
  context: EmitterContext
): IrType | undefined => {
  if (!contextualType) {
    return undefined;
  }

  return resolvePropertyType(contextualType, propertyName, context, []);
};

/**
 * Internal helper for property type resolution with cycle detection
 */
const resolveLocalTypeInfo = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): { readonly info: LocalTypeInfo } | undefined => {
  const lookupName = ref.name.includes(".")
    ? (ref.name.split(".").pop() ?? ref.name)
    : ref.name;

  const localHit = context.localTypes?.get(lookupName);
  if (localHit) {
    return { info: localHit };
  }

  const moduleMap = context.options.moduleMap;
  if (!moduleMap) return undefined;

  const matches: {
    readonly namespace: string;
    readonly info: LocalTypeInfo;
  }[] = [];
  for (const m of moduleMap.values()) {
    const info = m.localTypes?.get(lookupName);
    if (!info) continue;
    matches.push({ namespace: m.namespace, info });
  }

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return { info: matches[0]!.info };

  const fqn =
    ref.resolvedClrType ?? (ref.name.includes(".") ? ref.name : undefined);
  if (fqn && fqn.includes(".")) {
    const namespace = fqn.slice(0, fqn.lastIndexOf("."));
    const scoped = matches.filter((m) => m.namespace === namespace);
    if (scoped.length === 1) return { info: scoped[0]!.info };
  }

  return undefined;
};

/**
 * Internal helper for property type resolution with cycle detection
 */
const resolvePropertyType = (
  type: IrType,
  propertyName: string,
  context: EmitterContext,
  visitedTypes: readonly string[]
): IrType | undefined => {
  // Handle reference types (most common case)
  if (type.kind === "referenceType") {
    const typeInfoResult = resolveLocalTypeInfo(type, context);
    if (!typeInfoResult) {
      // External type - cannot resolve property type
      return undefined;
    }
    const typeInfo = typeInfoResult.info;

    // Prevent cycles
    const cycleKey = type.resolvedClrType ?? type.name;
    if (visitedTypes.includes(cycleKey)) {
      return undefined;
    }
    const newVisited = [...visitedTypes, cycleKey];

    // Chase type alias
    if (typeInfo.kind === "typeAlias") {
      const substituted = type.typeArguments
        ? substituteTypeArgs(
            typeInfo.type,
            typeInfo.typeParameters,
            type.typeArguments
          )
        : typeInfo.type;
      return resolvePropertyType(
        substituted,
        propertyName,
        context,
        newVisited
      );
    }

    // Look up property in interface
    if (typeInfo.kind === "interface") {
      // Search own members first
      const prop = findPropertyInMembers(typeInfo.members, propertyName);
      if (prop) {
        return type.typeArguments
          ? substituteTypeArgs(
              prop,
              typeInfo.typeParameters,
              type.typeArguments
            )
          : prop;
      }

      // Search extended interfaces
      for (const base of typeInfo.extends) {
        const baseProp = resolvePropertyType(
          base,
          propertyName,
          context,
          newVisited
        );
        if (baseProp) {
          return type.typeArguments
            ? substituteTypeArgs(
                baseProp,
                typeInfo.typeParameters,
                type.typeArguments
              )
            : baseProp;
        }
      }
      return undefined;
    }

    // Look up property in class
    if (typeInfo.kind === "class") {
      const prop = findPropertyInClassMembers(typeInfo.members, propertyName);
      if (prop) {
        return type.typeArguments
          ? substituteTypeArgs(
              prop,
              typeInfo.typeParameters,
              type.typeArguments
            )
          : prop;
      }
      return undefined;
    }

    return undefined;
  }

  // Handle object types directly
  if (type.kind === "objectType") {
    return findPropertyInMembers(type.members, propertyName);
  }

  return undefined;
};

/**
 * Find property type in interface members
 */
const findPropertyInMembers = (
  members: readonly IrInterfaceMember[],
  propertyName: string
): IrType | undefined => {
  for (const member of members) {
    if (member.kind === "propertySignature" && member.name === propertyName) {
      return member.type;
    }
  }
  return undefined;
};

/**
 * Get all property signatures for a type, including inherited interface members.
 *
 * Notes:
 * - Only supports referenceType → local interface lookup (synthetic union members are always interfaces).
 * - Derived members override base members by name.
 * - Cycle-safe via visitedTypes.
 */
export const getAllPropertySignatures = (
  type: IrType,
  context: EmitterContext
): readonly IrPropertySignature[] | undefined => {
  // We only expect nominal reference types here (Result__0<T,E>, etc.)
  if (type.kind !== "referenceType") return undefined;

  const typeInfoResult = resolveLocalTypeInfo(type, context);
  if (!typeInfoResult) return undefined;
  const typeInfo = typeInfoResult.info;
  if (!typeInfo || typeInfo.kind !== "interface") return undefined;

  // Collect into a map so derived overrides base by name deterministically
  const propMap = new Map<string, IrPropertySignature>();

  collectInterfaceProps(type, typeInfo, context, propMap, []);
  return [...propMap.values()];
};

/**
 * Internal: collect interface props + props from extends (cycle-safe).
 *
 * Ordering is important:
 * - Add own members first (so they override bases).
 * - Then walk extends for missing names.
 */
const collectInterfaceProps = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  typeInfo: Extract<LocalTypeInfo, { kind: "interface" }>,
  context: EmitterContext,
  out: Map<string, IrPropertySignature>,
  visitedTypes: readonly string[]
): void => {
  // Prevent cycles
  const cycleKey = ref.resolvedClrType ?? ref.name;
  if (visitedTypes.includes(cycleKey)) return;
  const nextVisited = [...visitedTypes, cycleKey];

  // Add own properties first (derived overrides base)
  for (const m of typeInfo.members) {
    if (m.kind === "propertySignature") {
      out.set(m.name, m);
    }
  }

  // Walk base interfaces
  for (const base of typeInfo.extends) {
    if (base.kind !== "referenceType") continue;
    const baseInfoResult = resolveLocalTypeInfo(base, context);
    const baseInfo = baseInfoResult?.info;
    if (!baseInfo || baseInfo.kind !== "interface") continue;

    // Recurse. If derived already set the name, we keep the derived one.
    const basePropMap = new Map<string, IrPropertySignature>();
    collectInterfaceProps(base, baseInfo, context, basePropMap, nextVisited);

    for (const [name, sig] of basePropMap.entries()) {
      if (!out.has(name)) {
        out.set(name, sig);
      }
    }
  }
};

/**
 * Select the best union member type to instantiate for an object literal.
 *
 * Example:
 *   type Result<T,E> = Result__0<T,E> | Result__1<T,E>
 *   return { ok: true, value }  // keys: ["ok","value"]
 * → choose Result__0<T,E>
 *
 * Matching rules (conservative):
 * - Only considers union members that are referenceTypes to local interfaces or classes.
 * - Object literal keys must be a subset of the candidate's property names.
 * - All *required* (non-optional) candidate properties must be present in the literal.
 *
 * Scoring (pick "most specific" deterministically):
 * 1) Fewer extra properties (candidateProps - literalKeys)
 * 2) More required properties (prefer tighter required shape)
 * 3) Fewer total properties
 * 4) Lexicographic by type name (stable tie-break)
 */
export const selectUnionMemberForObjectLiteral = (
  unionType: Extract<IrType, { kind: "unionType" }>,
  literalKeys: readonly string[],
  context: EmitterContext
): Extract<IrType, { kind: "referenceType" }> | undefined => {
  // Normalize keys (defensive: dedupe)
  const keySet = new Set(literalKeys.filter((k) => k.length > 0));
  const keys = [...keySet];

  type Candidate = {
    ref: Extract<IrType, { kind: "referenceType" }>;
    allProps: Set<string>;
    requiredProps: Set<string>;
  };

  const candidates: Candidate[] = [];

  for (const member of unionType.types) {
    if (member.kind !== "referenceType") continue;

    // If a union member is itself an alias, chase once (rare, but safe)
    const resolved = resolveTypeAlias(member, context);
    const ref =
      resolved.kind === "referenceType" ? resolved : (member as typeof member);

    const infoResult = resolveLocalTypeInfo(ref, context);
    const info = infoResult?.info;
    if (!info) continue;

    // Interface members: use property signatures (includes inherited interfaces).
    if (info.kind === "interface") {
      const props = getAllPropertySignatures(ref, context);
      if (!props) continue;

      const allProps = new Set(props.map((p) => p.name));
      const requiredProps = new Set(
        props.filter((p) => !p.isOptional).map((p) => p.name)
      );

      candidates.push({ ref, allProps, requiredProps });
      continue;
    }

    // Class members: use property declarations.
    // Anonymous object literal synthesis (TSN7403) emits DTO-like classes with `required` properties,
    // so unions over synthesized shapes must be matched here (not only interfaces).
    if (info.kind === "class") {
      const props = info.members.filter(
        (m) => m.kind === "propertyDeclaration"
      );
      const allProps = new Set(props.map((p) => p.name));
      const requiredProps = new Set(
        props.filter((p) => p.isRequired).map((p) => p.name)
      );

      candidates.push({ ref, allProps, requiredProps });
      continue;
    }
  }

  // Filter by match rules
  const matches = candidates.filter((c) => {
    // literal keys must exist on candidate
    for (const k of keys) {
      if (!c.allProps.has(k)) return false;
    }
    // candidate required props must be provided by literal
    for (const r of c.requiredProps) {
      if (!keySet.has(r)) return false;
    }
    return true;
  });

  if (matches.length === 0) return undefined;
  const firstMatch = matches[0];
  if (matches.length === 1 && firstMatch) return firstMatch.ref;

  // Pick best by score
  matches.sort((a, b) => {
    const aTotal = a.allProps.size;
    const bTotal = b.allProps.size;

    const aExtra = aTotal - keySet.size;
    const bExtra = bTotal - keySet.size;

    if (aExtra !== bExtra) return aExtra - bExtra; // fewer extras is better

    const aReq = a.requiredProps.size;
    const bReq = b.requiredProps.size;
    if (aReq !== bReq) return bReq - aReq; // more required is better

    if (aTotal !== bTotal) return aTotal - bTotal; // fewer total props is better

    return a.ref.name.localeCompare(b.ref.name); // stable tie-break
  });

  const best = matches[0];
  return best ? best.ref : undefined;
};

/**
 * Find property type in class members
 */
const findPropertyInClassMembers = (
  members: readonly IrClassMember[],
  propertyName: string
): IrType | undefined => {
  for (const member of members) {
    if (member.kind === "propertyDeclaration" && member.name === propertyName) {
      return member.type;
    }
  }
  return undefined;
};

/**
 * Strip null and undefined from a union type.
 *
 * Used when we need the non-nullable base type, e.g., for object instantiation
 * where `new T? { ... }` is invalid C# but `new T { ... }` is valid.
 *
 * @param type - The type to strip nullish from
 * @returns The non-nullish base type, or the original type if not a nullable union
 */
export const stripNullish = (type: IrType): IrType => {
  if (type.kind !== "unionType") return type;

  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );

  // Single non-nullish type: return it (e.g., T | null → T)
  if (nonNullish.length === 1 && nonNullish[0]) {
    return nonNullish[0];
  }

  // Multi-type union or no non-nullish types: return original
  return type;
};

/**
 * Known CLR struct types that are value types.
 */
const CLR_VALUE_TYPES = new Set([
  "global::System.DateTime",
  "global::System.DateOnly",
  "global::System.TimeOnly",
  "global::System.TimeSpan",
  "global::System.Guid",
  "global::System.Decimal",
  "System.DateTime",
  "System.DateOnly",
  "System.TimeOnly",
  "System.TimeSpan",
  "System.Guid",
  "System.Decimal",
]);

/**
 * Check if a type is definitely a C# value type.
 *
 * Value types require `default` instead of `null` in object initializers
 * because `null` cannot be assigned to non-nullable value types.
 *
 * @param type - The type to check (should be non-nullish, use stripNullish first)
 * @returns true if the type is a known value type
 */
export const isDefinitelyValueType = (type: IrType): boolean => {
  // Strip nullish first if caller forgot
  const base = stripNullish(type);

  // Primitive value types (number → double, int → int, boolean → bool, char → char)
  if (base.kind === "primitiveType") {
    return ["number", "int", "boolean", "char"].includes(base.name);
  }

  // Known CLR struct types
  if (base.kind === "referenceType") {
    const clr = base.resolvedClrType;
    if (clr && CLR_VALUE_TYPES.has(clr)) {
      return true;
    }
  }

  return false;
};

/**
 * Resolve a type alias to its underlying type.
 *
 * If the type is a reference type that points to a type alias,
 * returns the underlying type with type arguments substituted.
 *
 * @param type - The type to resolve
 * @param context - Emitter context with localTypes map
 * @returns The resolved underlying type, or the original type if not an alias
 */
export const resolveTypeAlias = (
  type: IrType,
  context: EmitterContext
): IrType => {
  if (type.kind !== "referenceType") {
    return type;
  }

  const localTypeInfo = context.localTypes?.get(type.name);
  if (localTypeInfo?.kind === "typeAlias") {
    // Substitute type arguments if present
    if (type.typeArguments && type.typeArguments.length > 0) {
      return substituteTypeArgs(
        localTypeInfo.type,
        localTypeInfo.typeParameters,
        type.typeArguments
      );
    }

    return localTypeInfo.type;
  }

  const aliasIndex = context.options.typeAliasIndex;
  if (!aliasIndex) {
    return type;
  }

  const stripGlobalPrefix = (name: string): string =>
    name.startsWith("global::") ? name.slice("global::".length) : name;

  const name = stripGlobalPrefix(type.name);
  const aliasEntry = name.includes(".")
    ? aliasIndex.byFqn.get(name)
    : (() => {
        const matches = aliasIndex.byName.get(name) ?? [];

        if (matches.length === 0) return undefined;
        if (matches.length === 1) return matches[0];

        const candidates = matches
          .map((m) => m.fqn)
          .sort()
          .join(", ");
        throw new Error(
          `ICE: Ambiguous type alias reference '${name}'. Candidates: ${candidates}`
        );
      })();

  if (!aliasEntry) {
    return type;
  }

  if (type.typeArguments && type.typeArguments.length > 0) {
    return substituteTypeArgs(
      aliasEntry.type,
      aliasEntry.typeParameters,
      type.typeArguments
    );
  }

  return aliasEntry.type;
};

/**
 * Find the index of a union member that matches a predicate target type.
 *
 * Used for union narrowing: given `isUser(account)` where account is `Union<User, Admin>`,
 * find which member index (0 or 1) corresponds to User.
 *
 * @param unionType - The union type to search
 * @param target - The predicate target type to find
 * @param context - Emitter context
 * @returns The 0-based index of the matching member, or undefined if not found
 */
export const findUnionMemberIndex = (
  unionType: Extract<IrType, { kind: "unionType" }>,
  target: IrType,
  context: EmitterContext
): number | undefined => {
  const resolvedTarget = resolveTypeAlias(stripNullish(target), context);

  // MVP: only handle reference-type targets
  if (resolvedTarget.kind !== "referenceType") return undefined;

  for (let i = 0; i < unionType.types.length; i++) {
    const m = unionType.types[i];
    if (m?.kind === "referenceType" && m.name === resolvedTarget.name) {
      // MVP: match by name; can tighten later to include typeArguments equality
      return i;
    }
  }
  return undefined;
};

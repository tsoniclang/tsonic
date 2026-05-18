/**
 * External Surface Semantic Registry — Loaded from target binding manifests
 *
 * This is a lightweight semantic index used by a few compiler passes
 * (e.g., override/shadow detection against external base classes).
 *
 * External semantics are loaded from binding metadata and source-package manifests.
 */

import type { BindingSemanticSignature } from "./program/binding-types.js";
import type { IrType } from "./ir/types/index.js";

/**
 * Metadata for a single external type member (method, property, etc.)
 */
export type ExternalMemberMetadata = {
  readonly kind: "method" | "property" | "field" | "event";
  readonly virtual?: boolean; // True if method is virtual/abstract
  readonly sealed?: boolean; // True if method is sealed (cannot override)
  readonly abstract?: boolean; // True if method is abstract
  /**
   * External visibility for this member.
   *
   * Used for airplane-grade override validation/emission: the target surface may
   * forbid changing accessibility when overriding. TypeScript cannot express
   * every external visibility distinction, so bindings provide the exact value.
   */
  readonly visibility?:
    | "public"
    | "protected"
    | "internal"
    | "protected internal"
    | "private";
};

/**
 * Metadata for a complete external type (class, interface, struct, etc.)
 */
export type ExternalTypeMetadata = {
  readonly kind: "class" | "interface" | "struct" | "enum";
  readonly baseType?: string;
  readonly interfaces?: readonly string[];
  /**
   * Methods indexed by:
   * - target member name
   * - parameter count
   * - signature key: "Type1,Type2|mods=1:out,3:ref"
   *
   * NOTE: We intentionally include parameter modifiers because target signatures
   * need exact ref/out/in identity for deterministic matching.
   */
  readonly methods: ReadonlyMap<
    string,
    ReadonlyMap<number, ReadonlyMap<string, ExternalMemberMetadata>>
  >;
  readonly properties: ReadonlyMap<string, ExternalMemberMetadata>;
};

/**
 * Target-neutral binding metadata consumed by this registry.
 */
export type ExternalBindingsFile = {
  readonly namespace: string;
  readonly types: readonly ExternalBindingsType[];
};

export type ExternalBindingsType = {
  readonly targetName: string;
  readonly kind?: string;
  readonly baseType?: { readonly targetName: string };
  readonly interfaces?: readonly { readonly targetName: string }[];
  readonly methods?: readonly ExternalBindingsMethod[];
  readonly properties?: readonly ExternalBindingsProperty[];
};

export type ExternalBindingsMethod = {
  readonly targetName: string;
  readonly isStatic?: boolean;
  readonly isVirtual?: boolean;
  readonly isSealed?: boolean;
  readonly isAbstract?: boolean;
  readonly parameterCount?: number;
  readonly visibility?: string;
  readonly canonicalSignature?: string;
  readonly semanticSignature?: BindingSemanticSignature;
  readonly parameterModifiers?: readonly { index: number; modifier: string }[];
};

export type ExternalBindingsProperty = {
  readonly targetName: string;
  readonly isStatic?: boolean;
  readonly isVirtual?: boolean;
  readonly isSealed?: boolean;
  readonly isAbstract?: boolean;
  readonly visibility?: string;
};

const joinTypeKeys = (prefix: string, keys: readonly string[]): string =>
  keys.length === 0 ? `${prefix}:` : `${prefix}:${keys.join(",")}`;

export const externalSignatureTypeKey = (
  type: IrType | undefined
): string | undefined => {
  if (!type) return undefined;

  switch (type.kind) {
    case "primitiveType":
      return `primitive:${type.name}`;
    case "literalType":
      return `literal:${typeof type.value}:${JSON.stringify(type.value)}`;
    case "typeParameterType":
      return `typeParameter:${type.name}`;
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "anyType":
      return "any";
    case "unknownType":
      return type.explicit === true ? "unknown:explicit" : "unknown";
    case "arrayType": {
      const element = externalSignatureTypeKey(type.elementType);
      return element ? `array:${element}` : undefined;
    }
    case "tupleType": {
      const elementKeys = type.elementTypes.map(externalSignatureTypeKey);
      if (elementKeys.some((key) => key === undefined)) return undefined;
      return joinTypeKeys("tuple", elementKeys as string[]);
    }
    case "dictionaryType": {
      const key = externalSignatureTypeKey(type.keyType);
      const value = externalSignatureTypeKey(type.valueType);
      return key && value ? `dictionary:${key}:${value}` : undefined;
    }
    case "referenceType": {
      const identity =
        type.providerQualifiedName !== undefined
          ? `target:${type.providerQualifiedName}`
          : type.typeId?.stableId !== undefined
            ? `id:${type.typeId.stableId}`
            : (type.typeId?.symbolId ?? type.symbolId) !== undefined
              ? `symbol:${type.typeId?.symbolId ?? type.symbolId}`
              : `reference:${type.name}`;
      const argumentKeys = (type.typeArguments ?? []).map(
        externalSignatureTypeKey
      );
      if (argumentKeys.some((key) => key === undefined)) return undefined;
      return argumentKeys.length === 0
        ? identity
        : `${identity}<${argumentKeys.join(",")}>`;
    }
    case "functionType": {
      const parameterKeys = type.parameters.map((parameter) => {
        const parameterType = externalSignatureTypeKey(parameter.type);
        return parameterType
          ? `${parameter.passing}:${parameter.isOptional ? 1 : 0}:${parameter.isRest ? 1 : 0}:${parameterType}`
          : undefined;
      });
      const returnKey = externalSignatureTypeKey(type.returnType);
      if (parameterKeys.some((key) => key === undefined) || !returnKey) {
        return undefined;
      }
      return `function:(${(parameterKeys as string[]).join(",")}):${returnKey}`;
    }
    case "objectType": {
      const memberKeys = type.members.map((member) => {
        if (member.kind === "propertySignature") {
          const memberType = externalSignatureTypeKey(member.type);
          return memberType
            ? `property:${member.name}:${member.isOptional ? 1 : 0}:${member.isReadonly ? 1 : 0}:${memberType}`
            : undefined;
        }

        const parameterKeys = member.parameters.map((parameter) => {
          const parameterType = externalSignatureTypeKey(parameter.type);
          return parameterType
            ? `${parameter.passing}:${parameter.isOptional ? 1 : 0}:${parameter.isRest ? 1 : 0}:${parameterType}`
            : undefined;
        });
        const returnKey = member.returnType
          ? externalSignatureTypeKey(member.returnType)
          : "void";
        if (parameterKeys.some((key) => key === undefined) || !returnKey) {
          return undefined;
        }
        return `method:${member.name}:${(parameterKeys as string[]).join(",")}:${returnKey}`;
      });
      if (memberKeys.some((key) => key === undefined)) return undefined;
      return joinTypeKeys("object", (memberKeys as string[]).slice().sort());
    }
    case "unionType": {
      const typeKeys = type.types.map(externalSignatureTypeKey);
      if (typeKeys.some((key) => key === undefined)) return undefined;
      return joinTypeKeys("union", (typeKeys as string[]).slice().sort());
    }
    case "intersectionType": {
      const typeKeys = type.types.map(externalSignatureTypeKey);
      if (typeKeys.some((key) => key === undefined)) return undefined;
      return joinTypeKeys(
        "intersection",
        (typeKeys as string[]).slice().sort()
      );
    }
  }
};

/**
 * Registry of all loaded external metadata.
 * Maps fully-qualified type names to their metadata
 */
export class ExternalMetadataRegistry {
  private readonly metadata = new Map<string, ExternalTypeMetadata>();

  private buildModifiersKey(
    mods: readonly { index: number; modifier: string }[] | undefined
  ): string {
    if (!mods || mods.length === 0) return "";
    return [...mods]
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((m) => `${m.index}:${m.modifier}`)
      .join(",");
  }

  private buildSignatureKey(
    parameterTypes: readonly string[],
    modifiersKey: string
  ): string {
    const typesKey = parameterTypes.join(",");
    const mods = modifiersKey ? `mods=${modifiersKey}` : "mods=";
    return `${typesKey}|${mods}`;
  }

  private getSemanticParamTypes(
    semanticSignature: BindingSemanticSignature | undefined
  ): readonly string[] | undefined {
    if (!semanticSignature) return undefined;

    const parameterTypes: string[] = [];
    for (const parameter of semanticSignature.parameters) {
      const key = externalSignatureTypeKey(parameter.type);
      if (!key) return undefined;
      parameterTypes.push(key);
    }

    return parameterTypes;
  }

  private normalizeRawSignatureTypeToken(rawToken: string): string | undefined {
    const withoutByRef = rawToken.endsWith("&")
      ? rawToken.slice(0, -1)
      : rawToken;
    const token = withoutByRef.trim();
    if (!token) return undefined;

    if (/^T\d*$/.test(token) || /^T[A-Z][a-zA-Z]*$/.test(token)) {
      return `typeParameter:${token}`;
    }

    if (token.endsWith("[]")) {
      const element = this.normalizeRawSignatureTypeToken(
        token.slice(0, -"[]".length)
      );
      return element ? `array:${element}` : undefined;
    }

    return token.includes(".") || token.includes("+") || token.includes("::")
      ? `target:${token}`
      : `reference:${token}`;
  }

  private parseCanonicalParamTypes(
    canonicalSignature: string | undefined
  ): readonly string[] | undefined {
    if (!canonicalSignature) return undefined;
    const match = canonicalSignature.match(/^\((.*)\):/);
    if (!match) return undefined;
    const paramsStr = match[1]?.trim() ?? "";
    if (paramsStr.length === 0) return [];

    // Split a comma-delimited type list, respecting nested bracket depth.
    // tsbindgen signatures use nested provider generic brackets in some contexts.
    const result: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of paramsStr) {
      if (ch === "[") {
        depth++;
        current += ch;
      } else if (ch === "]") {
        depth--;
        current += ch;
      } else if (ch === "," && depth === 0) {
        const token = this.normalizeRawSignatureTypeToken(current);
        if (!token) return undefined;
        result.push(token);
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) {
      const token = this.normalizeRawSignatureTypeToken(current);
      if (!token) return undefined;
      result.push(token);
    }
    return result;
  }

  /**
   * Load a tsbindgen bindings.json file and add its types to the registry.
   */
  loadBindingsFile(_filePath: string, content: ExternalBindingsFile): void {
    for (const type of content.types) {
      const kindMap: Record<string, ExternalTypeMetadata["kind"]> = {
        Class: "class",
        Interface: "interface",
        Struct: "struct",
        Enum: "enum",
      };

      const kind = kindMap[type.kind ?? ""] ?? "class";

      const visibilityMap: Record<string, ExternalMemberMetadata["visibility"]> =
        {
          Public: "public",
          Protected: "protected",
          ProtectedInternal: "protected internal",
          Internal: "internal",
          Private: "private",
        };

      const properties = new Map<string, ExternalMemberMetadata>();
      for (const prop of type.properties ?? []) {
        if (prop.isStatic) continue;
        properties.set(prop.targetName, {
          kind: "property",
          virtual: prop.isVirtual === true || prop.isAbstract === true,
          sealed: prop.isSealed === true,
          abstract: prop.isAbstract === true,
          visibility: visibilityMap[prop.visibility ?? ""] ?? undefined,
        });
      }

      const methods = new Map<
        string,
        Map<number, Map<string, ExternalMemberMetadata>>
      >();
      for (const method of type.methods ?? []) {
        if (method.isStatic) continue;
        const paramCount = method.parameterCount;
        if (typeof paramCount !== "number") continue;

        const paramTypes =
          this.getSemanticParamTypes(method.semanticSignature) ??
          this.parseCanonicalParamTypes(method.canonicalSignature);
        if (!paramTypes) continue;

        const modifiersKey = this.buildModifiersKey(method.parameterModifiers);
        const signatureKey = this.buildSignatureKey(paramTypes, modifiersKey);

        const byCount =
          methods.get(method.targetName) ??
          new Map<number, Map<string, ExternalMemberMetadata>>();

        const bySignature =
          byCount.get(paramCount) ?? new Map<string, ExternalMemberMetadata>();

        const existing = bySignature.get(signatureKey);
        const next: ExternalMemberMetadata = existing
          ? {
              kind: "method",
              virtual:
                existing.virtual === true ||
                method.isVirtual === true ||
                method.isAbstract === true,
              sealed: existing.sealed === true || method.isSealed === true,
              abstract:
                existing.abstract === true || method.isAbstract === true,
              visibility:
                existing.visibility ??
                visibilityMap[method.visibility ?? ""] ??
                undefined,
            }
          : {
              kind: "method",
              virtual: method.isVirtual === true || method.isAbstract === true,
              sealed: method.isSealed === true,
              abstract: method.isAbstract === true,
              visibility: visibilityMap[method.visibility ?? ""] ?? undefined,
            };

        bySignature.set(signatureKey, next);
        byCount.set(paramCount, bySignature);
        methods.set(method.targetName, byCount);
      }

      this.metadata.set(type.targetName, {
        kind,
        baseType: type.baseType?.targetName,
        interfaces: type.interfaces?.map((i) => i.targetName) ?? [],
        methods,
        properties,
      });
    }
  }

  /**
   * Look up metadata for an external type by fully-qualified name.
   */
  getTypeMetadata(qualifiedName: string): ExternalTypeMetadata | undefined {
    return this.metadata.get(qualifiedName);
  }

  /**
   * Look up metadata for a specific external method overload by signature.
   *
   * Airplane-grade: requires a deterministic match by full parameter types + modifiers.
   */
  getMethodMetadata(
    qualifiedTypeName: string,
    methodName: string,
    parameterTypes: readonly string[],
    modifiersKey: string
  ): ExternalMemberMetadata | undefined {
    const signatureKey = this.buildSignatureKey(parameterTypes, modifiersKey);
    const visited = new Set<string>();

    let current: string | undefined = qualifiedTypeName;
    while (current && !visited.has(current)) {
      visited.add(current);

      const typeMetadata = this.metadata.get(current);
      if (!typeMetadata) return undefined;

      const byCount = typeMetadata.methods.get(methodName);
      if (byCount) {
        const paramCount = parameterTypes.length;
        const bySignature = byCount.get(paramCount);
        if (bySignature) {
          const found = bySignature.get(signatureKey);
          if (found) return found;
        }
      }

      current = typeMetadata.baseType;
    }

    return undefined;
  }

  getMethodOverloadCount(
    qualifiedTypeName: string,
    methodName: string,
    parameterCount: number
  ): number {
    const typeMetadata = this.metadata.get(qualifiedTypeName);
    if (!typeMetadata) return 0;

    const byCount = typeMetadata.methods.get(methodName);
    if (!byCount) return 0;

    const bySignature = byCount.get(parameterCount);
    return bySignature?.size ?? 0;
  }

  getPropertyMetadata(
    qualifiedTypeName: string,
    propertyName: string
  ): ExternalMemberMetadata | undefined {
    const visited = new Set<string>();
    let current: string | undefined = qualifiedTypeName;
    while (current && !visited.has(current)) {
      visited.add(current);
      const typeMetadata = this.metadata.get(current);
      if (!typeMetadata) return undefined;
      const found = typeMetadata.properties.get(propertyName);
      if (found) return found;
      current = typeMetadata.baseType;
    }
    return undefined;
  }

  /**
   * Get all loaded type names
   */
  getAllTypeNames(): readonly string[] {
    return Array.from(this.metadata.keys());
  }

  /**
   * Clear all loaded metadata
   */
  clear(): void {
    this.metadata.clear();
  }
}

/**
 * Build a method signature string for metadata lookup
 * Format: "MethodName(type1,type2,...)"
 * @param methodName The method name
 * @param parameterTypes Array of parameter type names (e.g., ["string", "number"])
 * @returns Signature string for metadata lookup
 */
export const buildMethodSignature = (
  methodName: string,
  parameterTypes: readonly string[]
): string => {
  if (parameterTypes.length === 0) {
    return `${methodName}()`;
  }
  return `${methodName}(${parameterTypes.join(",")})`;
};

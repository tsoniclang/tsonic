/**
 * .NET Semantic Registry — Loaded from tsbindgen `<Namespace>/bindings.json`
 *
 * This is a lightweight semantic index used by a few compiler passes
 * (e.g., override/shadow detection against CLR base classes).
 *
 * NOTE: tsbindgen no longer emits `.metadata.json`. All CLR semantics needed
 * by the compiler live in `bindings.json`.
 */

/**
 * Metadata for a single .NET type member (method, property, etc.)
 */
export type DotnetMemberMetadata = {
  readonly kind: "method" | "property" | "field" | "event";
  readonly virtual?: boolean; // True if method is virtual/abstract
  readonly sealed?: boolean; // True if method is sealed (cannot override)
  readonly abstract?: boolean; // True if method is abstract
  /**
   * CLR visibility for this member.
   *
   * Used for airplane-grade override emission: C# does not allow changing
   * accessibility when overriding. TypeScript cannot express `protected internal`,
   * so we infer it from bindings and emit correct C# when TS uses `protected`.
   */
  readonly visibility?:
    | "public"
    | "protected"
    | "internal"
    | "protected internal"
    | "private";
};

/**
 * Metadata for a complete .NET type (class, interface, struct, etc.)
 */
export type DotnetTypeMetadata = {
  readonly kind: "class" | "interface" | "struct" | "enum";
  readonly baseType?: string;
  readonly interfaces?: readonly string[];
  /**
   * Methods indexed by:
   * - CLR method name
   * - parameter count
   * - signature key: "Type1,Type2|mods=1:out,3:ref"
   *
   * NOTE: We intentionally include parameter modifiers because CLR signatures
   * encode ref/out/in via byref + attributes; tsbindgen exposes this as
   * `parameterModifiers` for deterministic matching.
   */
  readonly methods: ReadonlyMap<
    string,
    ReadonlyMap<number, ReadonlyMap<string, DotnetMemberMetadata>>
  >;
  readonly properties: ReadonlyMap<string, DotnetMemberMetadata>;
};

/**
 * Minimal shape of tsbindgen `<Namespace>/bindings.json` (only fields we use here).
 */
export type TsbindgenBindingsFile = {
  readonly namespace: string;
  readonly types: readonly TsbindgenBindingsType[];
};

export type TsbindgenBindingsType = {
  readonly clrName: string;
  readonly kind?: string;
  readonly baseType?: { readonly clrName: string };
  readonly interfaces?: readonly { readonly clrName: string }[];
  readonly methods?: readonly TsbindgenBindingsMethod[];
  readonly properties?: readonly TsbindgenBindingsProperty[];
};

export type TsbindgenBindingsMethod = {
  readonly clrName: string;
  readonly isStatic?: boolean;
  readonly isVirtual?: boolean;
  readonly isSealed?: boolean;
  readonly isAbstract?: boolean;
  readonly parameterCount?: number;
  readonly visibility?: string;
  readonly canonicalSignature?: string;
  readonly parameterModifiers?: readonly { index: number; modifier: string }[];
};

export type TsbindgenBindingsProperty = {
  readonly clrName: string;
  readonly isStatic?: boolean;
  readonly isVirtual?: boolean;
  readonly isSealed?: boolean;
  readonly isAbstract?: boolean;
  readonly visibility?: string;
};

/**
 * Registry of all loaded .NET metadata
 * Maps fully-qualified type names to their metadata
 */
export class DotnetMetadataRegistry {
  private readonly metadata = new Map<string, DotnetTypeMetadata>();

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

  private parseCanonicalParamTypes(
    canonicalSignature: string | undefined
  ): readonly string[] | undefined {
    if (!canonicalSignature) return undefined;
    const match = canonicalSignature.match(/^\((.*)\):/);
    if (!match) return undefined;
    const paramsStr = match[1]?.trim() ?? "";
    if (paramsStr.length === 0) return [];

    // Split a comma-delimited type list, respecting nested bracket depth.
    // tsbindgen signatures use CLR-style nested generic brackets in some contexts.
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
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) {
      result.push(current.trim());
    }
    return result;
  }

  /**
   * Load a tsbindgen bindings.json file and add its types to the registry.
   */
  loadBindingsFile(_filePath: string, content: TsbindgenBindingsFile): void {
    for (const type of content.types) {
      const kindMap: Record<string, DotnetTypeMetadata["kind"]> = {
        Class: "class",
        Interface: "interface",
        Struct: "struct",
        Enum: "enum",
      };

      const kind = kindMap[type.kind ?? ""] ?? "class";

      const visibilityMap: Record<string, DotnetMemberMetadata["visibility"]> =
        {
          Public: "public",
          Protected: "protected",
          ProtectedInternal: "protected internal",
          Internal: "internal",
          Private: "private",
        };

      const properties = new Map<string, DotnetMemberMetadata>();
      for (const prop of type.properties ?? []) {
        if (prop.isStatic) continue;
        properties.set(prop.clrName, {
          kind: "property",
          virtual: prop.isVirtual === true || prop.isAbstract === true,
          sealed: prop.isSealed === true,
          abstract: prop.isAbstract === true,
          visibility: visibilityMap[prop.visibility ?? ""] ?? undefined,
        });
      }

      const methods = new Map<
        string,
        Map<number, Map<string, DotnetMemberMetadata>>
      >();
      for (const method of type.methods ?? []) {
        if (method.isStatic) continue;
        const paramCount = method.parameterCount;
        if (typeof paramCount !== "number") continue;

        const paramTypes = this.parseCanonicalParamTypes(
          method.canonicalSignature
        );
        if (!paramTypes) continue;

        const modifiersKey = this.buildModifiersKey(method.parameterModifiers);
        const signatureKey = this.buildSignatureKey(paramTypes, modifiersKey);

        const byCount =
          methods.get(method.clrName) ??
          new Map<number, Map<string, DotnetMemberMetadata>>();

        const bySignature =
          byCount.get(paramCount) ?? new Map<string, DotnetMemberMetadata>();

        const existing = bySignature.get(signatureKey);
        const next: DotnetMemberMetadata = existing
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
        methods.set(method.clrName, byCount);
      }

      this.metadata.set(type.clrName, {
        kind,
        baseType: type.baseType?.clrName,
        interfaces: type.interfaces?.map((i) => i.clrName) ?? [],
        methods,
        properties,
      });
    }
  }

  /**
   * Look up metadata for a .NET type by fully-qualified name
   */
  getTypeMetadata(qualifiedName: string): DotnetTypeMetadata | undefined {
    return this.metadata.get(qualifiedName);
  }

  /**
   * Look up metadata for a specific CLR method overload by signature.
   *
   * Airplane-grade: requires a deterministic match by full parameter types + modifiers.
   */
  getMethodMetadata(
    qualifiedTypeName: string,
    methodName: string,
    parameterTypes: readonly string[],
    modifiersKey: string
  ): DotnetMemberMetadata | undefined {
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
  ): DotnetMemberMetadata | undefined {
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
   * Check if a member is virtual (can be overridden)
   */
  isVirtualMember(qualifiedTypeName: string, memberSignature: string): boolean {
    // Legacy: kept for existing callers (none currently). Prefer getMethodMetadata/getPropertyMetadata.
    const memberMetadata = this.getPropertyMetadata(
      qualifiedTypeName,
      memberSignature
    );
    return memberMetadata?.virtual === true;
  }

  /**
   * Check if a member is sealed (cannot be overridden)
   */
  isSealedMember(qualifiedTypeName: string, memberSignature: string): boolean {
    // Legacy: kept for existing callers (none currently). Prefer getMethodMetadata/getPropertyMetadata.
    const memberMetadata = this.getPropertyMetadata(
      qualifiedTypeName,
      memberSignature
    );
    return memberMetadata?.sealed === true;
  }

  /**
   * Get the CLR visibility for a member, if known.
   */
  getMemberVisibility(
    qualifiedTypeName: string,
    memberSignature: string
  ): DotnetMemberMetadata["visibility"] | undefined {
    // Legacy: kept for existing callers (none currently). Prefer getMethodMetadata/getPropertyMetadata.
    const memberMetadata = this.getPropertyMetadata(
      qualifiedTypeName,
      memberSignature
    );
    return memberMetadata?.visibility;
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

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
  readonly visibility?: "public" | "protected" | "internal" | "protected internal" | "private";
};

/**
 * Metadata for a complete .NET type (class, interface, struct, etc.)
 */
export type DotnetTypeMetadata = {
  readonly kind: "class" | "interface" | "struct" | "enum";
  readonly methods: ReadonlyMap<string, ReadonlyMap<number, DotnetMemberMetadata>>;
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

      const visibilityMap: Record<string, DotnetMemberMetadata["visibility"]> = {
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

      const methods = new Map<string, Map<number, DotnetMemberMetadata>>();
      for (const method of type.methods ?? []) {
        if (method.isStatic) continue;
        const paramCount = method.parameterCount;
        if (typeof paramCount !== "number") continue;

        const byCount = methods.get(method.clrName) ?? new Map<number, DotnetMemberMetadata>();

        const existing = byCount.get(paramCount);
        const next: DotnetMemberMetadata = existing
          ? {
              kind: "method",
              virtual:
                existing.virtual === true ||
                method.isVirtual === true ||
                method.isAbstract === true,
              sealed: existing.sealed === true || method.isSealed === true,
              abstract: existing.abstract === true || method.isAbstract === true,
              visibility: existing.visibility ?? (visibilityMap[method.visibility ?? ""] ?? undefined),
            }
          : {
              kind: "method",
              virtual: method.isVirtual === true || method.isAbstract === true,
              sealed: method.isSealed === true,
              abstract: method.isAbstract === true,
              visibility: visibilityMap[method.visibility ?? ""] ?? undefined,
            };

        byCount.set(paramCount, next);
        methods.set(method.clrName, byCount);
      }

      this.metadata.set(type.clrName, {
        kind,
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
   * Look up metadata for a specific member of a .NET type
   * @param qualifiedTypeName Fully-qualified type name (e.g., "System.IO.StringWriter")
   * @param memberSignature Member signature (e.g., "ToString()" or "Write(string)")
   */
  getMemberMetadata(
    qualifiedTypeName: string,
    memberSignature: string
  ): DotnetMemberMetadata | undefined {
    const typeMetadata = this.metadata.get(qualifiedTypeName);
    if (!typeMetadata) {
      return undefined;
    }

    // Method signature: Name(type1,type2,...) — we only use arity (count) here.
    const sigMatch = memberSignature.match(/^([^(]+)\((.*)\)$/);
    if (sigMatch) {
      const methodName = sigMatch[1];
      if (!methodName) return undefined;
      const rawParams = sigMatch[2]?.trim() ?? "";
      const paramCount =
        rawParams.length === 0 ? 0 : rawParams.split(",").filter(Boolean).length;

      const byCount = typeMetadata.methods.get(methodName);
      if (!byCount) return undefined;

      const exact = byCount.get(paramCount);
      if (exact) return exact;

      // If there's exactly one overload for this name, accept it as the only candidate.
      if (byCount.size === 1) {
        return Array.from(byCount.values())[0];
      }

      return undefined;
    }

    // Property lookup
    return typeMetadata.properties.get(memberSignature);
  }

  /**
   * Check if a member is virtual (can be overridden)
   */
  isVirtualMember(qualifiedTypeName: string, memberSignature: string): boolean {
    const memberMetadata = this.getMemberMetadata(
      qualifiedTypeName,
      memberSignature
    );
    return memberMetadata?.virtual === true;
  }

  /**
   * Check if a member is sealed (cannot be overridden)
   */
  isSealedMember(qualifiedTypeName: string, memberSignature: string): boolean {
    const memberMetadata = this.getMemberMetadata(
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
    const memberMetadata = this.getMemberMetadata(
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

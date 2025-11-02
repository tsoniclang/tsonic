/**
 * .NET Metadata Loader - Reads .metadata.json files to determine override behavior
 */

/**
 * Metadata for a single .NET type member (method, property, etc.)
 */
export type DotnetMemberMetadata = {
  readonly kind: "method" | "property" | "field" | "event";
  readonly virtual?: boolean; // True if method is virtual/abstract
  readonly sealed?: boolean; // True if method is sealed (cannot override)
  readonly abstract?: boolean; // True if method is abstract
};

/**
 * Metadata for a complete .NET type (class, interface, struct, etc.)
 */
export type DotnetTypeMetadata = {
  readonly kind: "class" | "interface" | "struct" | "enum";
  readonly members: Readonly<Record<string, DotnetMemberMetadata>>;
};

/**
 * Complete metadata file structure
 */
export type DotnetMetadataFile = {
  readonly types: Readonly<Record<string, DotnetTypeMetadata>>;
};

/**
 * Registry of all loaded .NET metadata
 * Maps fully-qualified type names to their metadata
 */
export class DotnetMetadataRegistry {
  private readonly metadata = new Map<string, DotnetTypeMetadata>();

  /**
   * Load a metadata file and add its types to the registry
   */
  loadMetadataFile(_filePath: string, content: DotnetMetadataFile): void {
    for (const [typeName, typeMetadata] of Object.entries(content.types)) {
      this.metadata.set(typeName, typeMetadata);
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
    return typeMetadata.members[memberSignature];
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

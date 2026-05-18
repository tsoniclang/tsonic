/**
 * Resolver type definitions
 */

export type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isSourcePackage?: boolean;
  readonly resolutionKind: "local" | "externalSurface" | "phantomTypeOnly";
  readonly originalSpecifier: string;
  // For external-surface imports: the source-facing namespace from the package subpath.
  readonly resolvedNamespace?: string;
  // For module bindings mapped to target surface symbols.
  readonly providerQualifiedName?: string;
  readonly providerOwnerIdentity?: string;
};

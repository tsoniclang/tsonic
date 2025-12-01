/**
 * Resolver type definitions
 */

export type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isClr: boolean;
  readonly originalSpecifier: string;
  // For CLR imports: the CLR namespace (e.g., "System" from "@scope/pkg/System")
  readonly resolvedNamespace?: string;
  // For module bindings (Node.js APIs mapped to CLR types)
  readonly resolvedClrType?: string; // e.g., "Tsonic.NodeApi.fs"
  readonly resolvedAssembly?: string; // e.g., "Tsonic.NodeApi"
};

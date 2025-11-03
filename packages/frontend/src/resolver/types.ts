/**
 * Resolver type definitions
 */

export type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isDotNet: boolean;
  readonly originalSpecifier: string;
  // For module bindings (Node.js APIs mapped to CLR types)
  readonly resolvedClrType?: string; // e.g., "Tsonic.NodeApi.fs"
  readonly resolvedAssembly?: string; // e.g., "Tsonic.NodeApi"
};

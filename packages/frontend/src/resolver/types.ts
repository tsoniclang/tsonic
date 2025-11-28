/**
 * Resolver type definitions
 */

export type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isDotNet: boolean;
  readonly originalSpecifier: string;
  // For .NET imports: the CLR namespace (e.g., "System" from "@tsonic/dotnet/System")
  readonly resolvedNamespace?: string;
  // For module bindings (Node.js APIs mapped to CLR types)
  readonly resolvedClrType?: string; // e.g., "Tsonic.NodeApi.fs"
  readonly resolvedAssembly?: string; // e.g., "Tsonic.NodeApi"
};

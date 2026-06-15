/**
 * Resolver type definitions
 */

export type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isSourcePackage?: boolean;
  readonly resolutionKind: "local" | "phantomTypeOnly";
  readonly originalSpecifier: string;
};

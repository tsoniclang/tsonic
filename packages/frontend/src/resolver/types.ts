/**
 * Resolver type definitions
 */

export type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isDotNet: boolean;
  readonly originalSpecifier: string;
};

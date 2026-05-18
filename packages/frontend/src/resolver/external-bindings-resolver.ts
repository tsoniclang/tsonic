/**
 * external bindings resolution for package imports
 *
 * Determines if an import specifier refers to a external namespace by checking
 * if bindings.json exists in the package's namespace directory.
 *
 * FACADE: re-exports from external-bindings-resolve-logic and external-bindings-package-resolution.
 */

import { ExternalBindingsResolver as ExternalBindingsResolverImpl } from "./external-bindings-resolve-logic.js";

/**
 * Result of resolving a external import
 */
export type ResolvedExternalImport =
  | {
      readonly kind: "externalSurface";
      readonly packageName: string;
      readonly resolvedNamespace: string;
      readonly bindingsPath: string;
      readonly ownerIdentity: string | undefined;
    }
  | {
      readonly kind: "notExternalSurface";
    };

/**
 * Parsed module specifier
 */
export type ParsedSpecifier = {
  readonly packageName: string;
  readonly subpath: string;
};

export { ExternalBindingsResolver } from "./external-bindings-resolve-logic.js";

/**
 * Create a resolver instance for a given source root
 */
export const createExternalBindingsResolver = (
  sourceRoot: string
): ExternalBindingsResolverImpl => {
  return new ExternalBindingsResolverImpl(sourceRoot);
};

/**
 * CLR bindings resolution for package imports
 *
 * Determines if an import specifier refers to a CLR namespace by checking
 * if bindings.json exists in the package's namespace directory.
 *
 * FACADE: re-exports from clr-bindings-resolve-logic and clr-bindings-package-resolution.
 */

import { ClrBindingsResolver as ClrBindingsResolverImpl } from "./clr-bindings-resolve-logic.js";

/**
 * Result of resolving a CLR import
 */
export type ResolvedClrImport =
  | {
      readonly isClr: true;
      readonly packageName: string;
      readonly resolvedNamespace: string;
      readonly bindingsPath: string;
      readonly assembly: string | undefined;
    }
  | {
      readonly isClr: false;
    };

/**
 * Parsed module specifier
 */
export type ParsedSpecifier = {
  readonly packageName: string;
  readonly subpath: string;
};

export { ClrBindingsResolver } from "./clr-bindings-resolve-logic.js";

/**
 * Create a resolver instance for a given source root
 */
export const createClrBindingsResolver = (
  sourceRoot: string
): ClrBindingsResolverImpl => {
  return new ClrBindingsResolverImpl(sourceRoot);
};

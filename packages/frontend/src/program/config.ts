/**
 * TypeScript compiler configuration
 */

import * as ts from "typescript";

/**
 * Default TypeScript compiler options for Tsonic
 */
export const defaultTsConfig: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  // We use globals from the active external surface instead of npm ambient packages.
  // The external surface provides a globals.d.ts with the minimal supported types.
  noLib: true,
  types: [], // No npm packages - globals come from external surface typeRoots
  // Airplane-grade default: full TypeScript strictness.
  // We rely on strict TS diagnostics to prevent “TS accepts it, target emission cannot” cases
  // (especially around overload selection and delegate assignability).
  strict: true,
  // Keep function-parameter variance strict (redundant under `strict`, but
  // explicit for clarity).
  strictFunctionTypes: true,
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  allowJs: false,
  checkJs: false,
  noEmit: true,
  resolveJsonModule: false,
  isolatedModules: true, // Re-enabled - safe now that DOM globals are gone
  verbatimModuleSyntax: false, // Disabled to allow external type imports
  allowImportingTsExtensions: true, // ESM requires .ts/.js extensions
};

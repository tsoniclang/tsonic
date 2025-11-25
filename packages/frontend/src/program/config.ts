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
  // We use the globals from the BCL bindings directory instead of npm packages
  // The BCL bindings include a globals.d.ts that provides minimal types
  noLib: true,
  types: [], // No npm packages - globals come from BCL bindings typeRoots
  strict: false, // Disabled to allow .NET type usage
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  allowJs: false,
  checkJs: false,
  noEmit: true,
  resolveJsonModule: false,
  isolatedModules: true, // Re-enabled - safe now that DOM globals are gone
  verbatimModuleSyntax: false, // Disabled to allow .NET type imports
  noImplicitAny: false, // Allow any for .NET types
  allowImportingTsExtensions: true, // ESM requires .ts/.js extensions
};

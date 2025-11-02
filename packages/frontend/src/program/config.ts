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
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  allowJs: false,
  checkJs: false,
  noEmit: true,
  resolveJsonModule: false,
  isolatedModules: true,
  verbatimModuleSyntax: true,
};

/**
 * Validation orchestrator - coordinates all validation functions
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  createDiagnosticsCollector,
} from "../types/diagnostic.js";
import { validateImports } from "./imports.js";
import { validateExports } from "./exports.js";
import { validateUnsupportedFeatures } from "./features.js";
import { validateGenerics } from "./generics.js";
import { validateExtensionMethods } from "./extension-methods.js";
import { validateStaticSafety } from "./static-safety.js";

/**
 * Validate an entire Tsonic program
 */
export const validateProgram = (
  program: TsonicProgram
): DiagnosticsCollector => {
  const collector = createDiagnosticsCollector();

  return program.sourceFiles.reduce(
    (acc, sourceFile) => validateSourceFile(sourceFile, program, acc),
    collector
  );
};

/**
 * Validate a single source file
 */
export const validateSourceFile = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const validationFns = [
    validateImports,
    validateExports,
    validateUnsupportedFeatures,
    validateGenerics,
    validateExtensionMethods,
    validateStaticSafety,
  ];

  return validationFns.reduce(
    (acc, fn) => fn(sourceFile, program, acc),
    collector
  );
};

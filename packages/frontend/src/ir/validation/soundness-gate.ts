/**
 * IR Soundness Gate - Validates IR before emission
 *
 * Walks the produced IR and asserts:
 * - No `anyType` anywhere (TSN7401 for explicit any, TSN7414 for unrepresentable)
 * - No unresolved/unsupported placeholders
 *
 * If this pass emits any errors, the emitter must not run.
 */

import { IrModule } from "../types.js";
import type {
  SoundnessGateOptions,
  SoundnessValidationResult,
  ValidationContext,
} from "./soundness-gate-shared.js";
import {
  extractImportedTypeNames,
  extractLocalTypeNames,
  validateStatement,
} from "./soundness-gate-statement-validation.js";
import { validateExpression } from "./soundness-gate-expression-validation.js";

/**
 * Validate a single module
 */
const validateModule = (
  module: IrModule,
  knownReferenceTypes: ReadonlySet<string>,
  namespaceLocalTypeNames: ReadonlySet<string>,
  options: SoundnessGateOptions
): ValidationContext["diagnostics"] => {
  // Extract local and imported type names for reference type validation
  const localTypeNames = extractLocalTypeNames(module.body);
  const importedTypeNames = extractImportedTypeNames(module);

  const ctx: ValidationContext = {
    filePath: module.filePath,
    namespace: module.namespace,
    diagnostics: [],
    localTypeNames,
    namespaceLocalTypeNames,
    importedTypeNames,
    knownReferenceTypes,
    backendCapabilities: options.backendCapabilities,
    typeParameterNames: new Set(), // Will be populated per-scope during validation
    activeTypeValidation: new WeakSet<object>(),
  };

  // Validate all statements in the module body
  module.body.forEach((stmt) => validateStatement(stmt, ctx));

  // Validate exports
  module.exports.forEach((exp) => {
    if (exp.kind === "default") {
      validateExpression(exp.expression, ctx);
    } else if (exp.kind === "declaration") {
      validateStatement(exp.declaration, ctx);
    }
  });

  return ctx.diagnostics;
};

/**
 * Run soundness validation on all modules
 *
 * This is the IR soundness gate - if any diagnostics are returned,
 * the emitter must not run.
 */
export const validateIrSoundness = (
  modules: readonly IrModule[],
  options: SoundnessGateOptions = {}
): SoundnessValidationResult => {
  const allDiagnostics: ValidationContext["diagnostics"] = [];
  const knownReferenceTypes = options.knownReferenceTypes ?? new Set<string>();
  const namespaceTypeNames = new Map<string, Set<string>>();

  for (const module of modules) {
    const current =
      namespaceTypeNames.get(module.namespace) ?? new Set<string>();
    for (const name of extractLocalTypeNames(module.body)) {
      current.add(name);
    }
    namespaceTypeNames.set(module.namespace, current);
  }

  for (const module of modules) {
    const moduleDiagnostics = validateModule(
      module,
      knownReferenceTypes,
      namespaceTypeNames.get(module.namespace) ?? new Set<string>(),
      options
    );
    allDiagnostics.push(...moduleDiagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    diagnostics: allDiagnostics,
  };
};

export type { SoundnessGateOptions, SoundnessValidationResult };

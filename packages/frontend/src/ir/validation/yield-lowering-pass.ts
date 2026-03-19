/**
 * Yield Lowering Pass (facade)
 *
 * Transforms yield expressions in generator functions into IrYieldStatement nodes.
 * This pass runs after IR building and before numeric proof pass.
 *
 * Implementation is split across:
 * - yield-lowering-helpers.ts    — shared types, utilities, yield detection/analysis
 * - yield-expression-lowering.ts — expression-tree yield lowering
 * - yield-statement-lowering.ts  — generator-context statement lowering
 * - yield-module-processing.ts   — non-generator recursion, class & module processing
 *
 * Supported patterns:
 * - `yield expr;` → IrYieldStatement with no receiveTarget
 * - `const x = yield expr;` → IrYieldStatement with receiveTarget = identifierPattern
 * - `x = yield expr;` → IrYieldStatement with receiveTarget = identifierPattern
 * - `const {a, b} = yield expr;` → IrYieldStatement with receiveTarget = objectPattern
 * - `const [a, b] = yield expr;` → IrYieldStatement with receiveTarget = arrayPattern
 * - `return yield expr;` → IrYieldStatement + IrGeneratorReturnStatement(temp)
 * - `throw yield expr;` → IrYieldStatement + IrThrowStatement(temp)
 * - `for (x = yield expr; ... )` → IrYieldStatement + ForStatement(without initializer)
 * - `for (; yield cond; ... )` → ForStatement(condition=true) + loop-body condition prelude
 * - `for (...; ...; yield update)` → ForStatement(update=undefined) + loop-body update prelude
 * - `for (... of yield expr)` / `for (... in yield expr)` → IrYieldStatement + loop over temp
 * - `if (yield expr) { ... }` → IrYieldStatement + IfStatement(temp)
 * - `switch (yield expr) { ... }` → IrYieldStatement + SwitchStatement(temp)
 * - `while (yield expr) { ... }` → While(true) with per-iteration yield+guard
 * - `const x = cond ? (yield a) : (yield b)` → temp + branch-lowered yields
 *
 * Unsupported patterns (emit TSN6101 diagnostic):
 * - assignment target forms that cannot be lowered as a deterministic l-value
 */

import { Diagnostic } from "../../types/diagnostic.js";
import { IrModule } from "../types.js";

import { processModule } from "./yield-module-processing.js";

/**
 * Result of yield lowering pass
 */
export type YieldLoweringResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Run yield lowering pass on all modules.
 *
 * This pass transforms yield expressions in generator functions into
 * IrYieldStatement nodes that the emitter can directly consume.
 *
 * HARD GATE: If any diagnostics are returned, the emitter MUST NOT run.
 */
export const runYieldLoweringPass = (
  modules: readonly IrModule[]
): YieldLoweringResult => {
  const processedModules: IrModule[] = [];
  const allDiagnostics: Diagnostic[] = [];

  for (const module of modules) {
    const result = processModule(module);
    processedModules.push(result.module);
    allDiagnostics.push(...result.diagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    modules: processedModules,
    diagnostics: allDiagnostics,
  };
};

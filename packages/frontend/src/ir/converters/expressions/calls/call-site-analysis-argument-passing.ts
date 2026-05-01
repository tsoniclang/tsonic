/**
 * Call-site analysis — Argument passing & binding resolution
 *
 * Argument modifiers, binding resolution helpers, and parameter mode
 * detection for call/new expression converters. Split from
 * call-site-analysis.ts for file-size compliance.
 */

import * as ts from "typescript";
import { getSourceSpan } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import { createDiagnostic } from "../../../../types/diagnostic.js";
import { convertExpression } from "../../../expression-converter.js";
import type { CallSiteArgModifier } from "./call-site-analysis-unification.js";

/**
 * Unwrap call-site argument modifier markers.
 *
 * @tsonic/core/lang.js exports compile-time-only intrinsics:
 * - out(x)   → emit `out x` at the call site
 * - ref(x)   → emit `ref x`
 * - inref(x) → emit `in x`
 *
 * These markers must be erased by the compiler and must never reach emission as
 * normal calls.
 */
export const unwrapCallSiteArgumentModifier = (
  expr: ts.Expression
): {
  readonly expression: ts.Expression;
  readonly modifier?: CallSiteArgModifier;
} => {
  // Unwrap parentheses first (out((x)) etc).
  let current: ts.Expression = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }

  if (!ts.isCallExpression(current)) return { expression: expr };
  if (!ts.isIdentifier(current.expression)) return { expression: expr };

  const name = current.expression.text;
  if (name !== "out" && name !== "ref" && name !== "inref") {
    return { expression: expr };
  }

  // Markers are non-generic and take exactly one argument.
  if (current.typeArguments && current.typeArguments.length > 0) {
    return { expression: expr };
  }
  if (current.arguments.length !== 1) {
    return { expression: expr };
  }

  const inner = current.arguments[0];
  if (!inner) return { expression: expr };

  const modifier: CallSiteArgModifier =
    name === "inref" ? "in" : (name as "out" | "ref");
  return { expression: inner, modifier };
};

export const applyCallSiteArgumentModifiers = (
  base: readonly ("value" | "ref" | "out" | "in")[] | undefined,
  overrides: readonly (CallSiteArgModifier | undefined)[],
  argCount: number,
  ctx: ProgramContext,
  node: ts.CallExpression | ts.NewExpression
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  const hasOverrides = overrides.some((m) => m !== undefined);
  if (!hasOverrides) return base;

  const passing: ("value" | "ref" | "out" | "in")[] =
    base?.slice(0, argCount) ?? Array(argCount).fill("value");

  for (let i = 0; i < argCount; i++) {
    const override = overrides[i];
    if (!override) continue;

    const existing = passing[i];
    // If we have a resolved signature, call-site modifiers must match it exactly.
    // (We do not currently use call-site modifiers to influence overload resolution.)
    if (base !== undefined && existing !== override) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7444",
          "error",
          `Call-site passing modifier '${override}' conflicts with resolved signature (expected '${existing}' at argument ${i}).`,
          getSourceSpan(node),
          "Remove the call-site modifier, or call the correct overload that matches ref/out/in."
        )
      );
      continue;
    }

    passing[i] = override;
  }

  return passing;
};

/**
 * Extract argument passing modes from resolved signature.
 * Returns array aligned with arguments, indicating ref/out/in/value for each.
 *
 * ALICE'S SPEC: Uses TypeSystem to get parameter modes.
 * Parameter modes were normalized in Binding at registration time.
 */
export const extractArgumentPassing = (
  node: ts.CallExpression | ts.NewExpression,
  ctx: ProgramContext
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  // Get the TypeSystem
  const typeSystem = ctx.typeSystem;

  // Handle both CallExpression and NewExpression
  const sigId = ts.isCallExpression(node)
    ? ctx.binding.resolveCallSignature(node)
    : ctx.binding.resolveConstructorSignature(node);
  if (!sigId) return undefined;

  // Use TypeSystem.resolveCall() to get parameter modes
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount: ts.isCallExpression(node)
      ? node.arguments.length
      : (node.arguments?.length ?? 0),
  });

  // Return parameter modes from TypeSystem (already normalized in Binding)
  return resolved.parameterModes;
};

export const extractArgumentPassingFromParameterModifiers = (
  modifiers: readonly {
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }[],
  argCount: number
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  if (modifiers.length === 0) return undefined;

  const passing: ("value" | "ref" | "out" | "in")[] =
    Array(argCount).fill("value");
  for (const mod of modifiers) {
    if (mod.index >= 0 && mod.index < argCount) {
      passing[mod.index] = mod.modifier;
    }
  }
  return passing;
};

/**
 * Extract argument passing modes from the member binding attached by frontend
 * property-access resolution.
 *
 * Overload-specific ref/out/in selection must be resolved by the call/type-system
 * path and represented on the resolved signature. This helper only consumes
 * modifiers that were already proven safe to attach to the concrete member access
 * (for example non-overloaded members or extension methods resolved against the
 * actual call expression).
 */
export const extractArgumentPassingFromBinding = (
  callee: ReturnType<typeof convertExpression>,
  argCount: number
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  if (callee.kind !== "memberAccess" || !callee.memberBinding) return undefined;

  const directMods = callee.memberBinding.parameterModifiers;
  if (directMods && directMods.length > 0) {
    return extractArgumentPassingFromParameterModifiers(directMods, argCount);
  }

  return undefined;
};

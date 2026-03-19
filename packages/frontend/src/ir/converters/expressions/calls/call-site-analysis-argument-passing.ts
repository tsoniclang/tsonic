/**
 * Call-site analysis — Argument passing & binding resolution
 *
 * Argument modifiers, binding resolution helpers, and parameter mode
 * detection for call/new expression converters. Split from
 * call-site-analysis.ts for file-size compliance.
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";
import { getSourceSpan } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import type { MemberBinding } from "../../../../program/bindings.js";
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
 * Extract argument passing modes from CLR bindings for the *selected overload*.
 *
 * CRITICAL: Methods can be overloaded, and overloads can differ in ref/out/in modifiers.
 * We must not attach a single overload's modifiers to the member access itself.
 *
 * This resolver selects the best-matching binding overload using the call's argument
 * types, then applies that overload's parameterModifiers.
 */
export const extractArgumentPassingFromBinding = (
  callee: ReturnType<typeof convertExpression>,
  argCount: number,
  ctx: ProgramContext,
  parameterTypes: readonly (IrType | undefined)[] | undefined,
  argTypes: readonly (IrType | undefined)[] | undefined
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  if (callee.kind !== "memberAccess" || !callee.memberBinding) return undefined;

  // Fast path: already-resolved modifiers (extension methods or non-overloaded members).
  const directMods = callee.memberBinding.parameterModifiers;
  if (directMods && directMods.length > 0) {
    return extractArgumentPassingFromParameterModifiers(directMods, argCount);
  }

  // No member binding → no CLR parameter modifiers.
  const binding = callee.memberBinding;
  const overloadsAll = ctx.bindings.getClrMemberOverloads(
    binding.assembly,
    binding.type,
    binding.member
  );
  if (!overloadsAll || overloadsAll.length === 0) return undefined;

  const calledName =
    typeof callee.property === "string" ? callee.property : undefined;
  const overloads = calledName
    ? overloadsAll.filter(
        (m) => m.alias === calledName || m.name === calledName
      )
    : overloadsAll;
  if (overloads.length === 0) return undefined;

  const matchTypes = parameterTypes ?? argTypes;
  const hasMatchTypes = matchTypes && matchTypes.some((t) => t !== undefined);

  const splitSignatureTypeList = (str: string): string[] => {
    const result: string[] = [];
    let depth = 0;
    let current = "";

    for (const char of str) {
      if (char === "[") {
        depth++;
        current += char;
      } else if (char === "]") {
        depth--;
        current += char;
      } else if (char === "," && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) result.push(current.trim());
    return result;
  };

  const parseParameterTypes = (sig: string | undefined): readonly string[] => {
    if (!sig) return [];
    const paramsMatch = sig.match(/\|\(([^)]*)\):/);
    const paramsStr = paramsMatch?.[1]?.trim();
    if (!paramsStr) return [];
    return splitSignatureTypeList(paramsStr).map((s) => s.trim());
  };

  const extractSimpleClrName = (typeName: string): string => {
    let t = typeName.trim();
    if (t.endsWith("&")) t = t.slice(0, -1);
    if (t.endsWith("[]")) t = t.slice(0, -2);
    const bracket = t.indexOf("[");
    if (bracket >= 0) t = t.slice(0, bracket);
    const lastDot = t.lastIndexOf(".");
    if (lastDot >= 0) t = t.slice(lastDot + 1);
    return t;
  };

  const primitiveToClrSimpleName = (name: string): string | undefined => {
    switch (name) {
      case "string":
        return "String";
      case "boolean":
      case "bool":
        return "Boolean";
      case "char":
        return "Char";
      case "byte":
        return "Byte";
      case "sbyte":
        return "SByte";
      case "short":
        return "Int16";
      case "ushort":
        return "UInt16";
      case "int":
        return "Int32";
      case "uint":
        return "UInt32";
      case "long":
        return "Int64";
      case "ulong":
        return "UInt64";
      case "float":
        return "Single";
      case "double":
        return "Double";
      case "decimal":
        return "Decimal";
      default:
        return undefined;
    }
  };

  const collectMatchNames = (t: IrType): readonly string[] => {
    switch (t.kind) {
      case "primitiveType": {
        const mapped = primitiveToClrSimpleName(t.name);
        return mapped ? [mapped] : [];
      }
      case "referenceType": {
        const lastDot = t.name.lastIndexOf(".");
        const simple = lastDot >= 0 ? t.name.slice(lastDot + 1) : t.name;
        return [
          simple
            .replace(/\$instance$/, "")
            .replace(/^__/, "")
            .replace(/\$views$/, ""),
        ];
      }
      case "unionType":
        return Array.from(
          new Set(t.types.flatMap((x) => collectMatchNames(x)))
        );
      case "intersectionType":
        return Array.from(
          new Set(t.types.flatMap((x) => collectMatchNames(x)))
        );
      default:
        return [];
    }
  };

  const modifiersKey = (m: MemberBinding): string => {
    const mods = m.parameterModifiers ?? [];
    if (mods.length === 0) return "";
    return [...mods]
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((mod) => `${mod.index}:${mod.modifier}`)
      .join(",");
  };

  const scoreCandidate = (m: MemberBinding): number => {
    if (!hasMatchTypes) return 0;
    const paramTypes = parseParameterTypes(m.signature);
    let score = 0;
    for (let i = 0; i < argCount; i++) {
      const expected = matchTypes?.[i];
      if (!expected) continue;

      const expectedNames = collectMatchNames(expected);
      if (expectedNames.length === 0) continue;

      const paramType = paramTypes[i];
      if (!paramType) continue;
      const paramName = extractSimpleClrName(paramType);

      if (expectedNames.includes(paramName)) {
        score += 10;
      } else {
        score -= 3;
      }
    }
    return score;
  };

  // Discard candidates that can't accept the provided arguments (best-effort, arity only).
  const candidates = overloads.filter((m) => {
    if (typeof m.parameterCount !== "number") return true;
    return m.parameterCount >= argCount;
  });
  if (candidates.length === 0) return undefined;

  let bestScore = Number.NEGATIVE_INFINITY;
  let best: MemberBinding[] = [];
  for (const c of candidates) {
    const score = scoreCandidate(c);
    if (score > bestScore) {
      bestScore = score;
      best = [c];
    } else if (score === bestScore) {
      best.push(c);
    }
  }

  if (best.length === 0) return undefined;

  // If ambiguous, only accept when all best candidates agree on modifiers.
  const first = best[0];
  if (!first) return undefined;
  const key = modifiersKey(first);
  if (best.some((m) => modifiersKey(m) !== key)) {
    return undefined;
  }

  const chosenMods = first.parameterModifiers;
  if (!chosenMods || chosenMods.length === 0) return undefined;
  return extractArgumentPassingFromParameterModifiers(chosenMods, argCount);
};

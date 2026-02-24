/**
 * Call-site analysis helpers
 *
 * Argument modifiers, binding resolution helpers, parameter mode detection,
 * and type template unification for call/new expression converters.
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";
import {
  irTypesEqual,
  referenceTypeIdentity,
  stableIrTypeKey,
  unwrapAsyncWrapperType,
} from "../../../types/type-ops.js";
import { getSourceSpan } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import type { MemberBinding } from "../../../../program/bindings.js";
import { createDiagnostic } from "../../../../types/diagnostic.js";
import { convertExpression } from "../../../expression-converter.js";

export type CallSiteArgModifier = "ref" | "out" | "in";

export const unifyTypeTemplate = (
  template: IrType,
  actual: IrType,
  substitutions: Map<string, IrType>
): boolean => {
  if (template.kind === "typeParameterType") {
    const existing = substitutions.get(template.name);
    if (!existing) {
      substitutions.set(template.name, actual);
      return true;
    }
    return irTypesEqual(existing, actual);
  }

  if (template.kind !== actual.kind) return false;

  switch (template.kind) {
    case "primitiveType":
      return template.name === (actual as typeof template).name;
    case "literalType":
      return template.value === (actual as typeof template).value;
    case "voidType":
    case "unknownType":
    case "anyType":
    case "neverType":
      return true;
    case "arrayType":
      return unifyTypeTemplate(
        template.elementType,
        (actual as typeof template).elementType,
        substitutions
      );
    case "tupleType": {
      const rhs = actual as typeof template;
      if (template.elementTypes.length !== rhs.elementTypes.length)
        return false;
      return template.elementTypes.every((t, i) => {
        const other = rhs.elementTypes[i];
        return other ? unifyTypeTemplate(t, other, substitutions) : false;
      });
    }
    case "dictionaryType":
      return (
        unifyTypeTemplate(
          template.keyType,
          (actual as typeof template).keyType,
          substitutions
        ) &&
        unifyTypeTemplate(
          template.valueType,
          (actual as typeof template).valueType,
          substitutions
        )
      );
    case "referenceType": {
      const rhs = actual as typeof template;
      if (referenceTypeIdentity(template) !== referenceTypeIdentity(rhs))
        return false;
      const templateArgs = template.typeArguments ?? [];
      const actualArgs = rhs.typeArguments ?? [];
      if (templateArgs.length !== actualArgs.length) return false;
      return templateArgs.every((t, i) => {
        const other = actualArgs[i];
        return other ? unifyTypeTemplate(t, other, substitutions) : false;
      });
    }
    case "unionType":
    case "intersectionType": {
      const rhs = actual as typeof template;
      if (template.types.length !== rhs.types.length) return false;
      return template.types.every((t, i) => {
        const other = rhs.types[i];
        return other ? unifyTypeTemplate(t, other, substitutions) : false;
      });
    }
    case "functionType": {
      const rhs = actual as typeof template;
      if (template.parameters.length !== rhs.parameters.length) return false;
      const paramsMatch = template.parameters.every((p, i) => {
        const other = rhs.parameters[i];
        if (
          !other ||
          p.isRest !== other.isRest ||
          p.isOptional !== other.isOptional
        )
          return false;
        if (!p.type || !other.type) return p.type === other.type;
        return unifyTypeTemplate(p.type, other.type, substitutions);
      });
      return (
        paramsMatch &&
        unifyTypeTemplate(template.returnType, rhs.returnType, substitutions)
      );
    }
    case "objectType": {
      const rhs = actual as typeof template;
      if (template.members.length !== rhs.members.length) return false;
      return template.members.every((m, i) => {
        const other = rhs.members[i];
        if (!other || m.kind !== other.kind || m.name !== other.name) {
          return false;
        }
        if (m.kind === "propertySignature") {
          return (
            other.kind === "propertySignature" &&
            m.isOptional === other.isOptional &&
            m.isReadonly === other.isReadonly &&
            unifyTypeTemplate(m.type, other.type, substitutions)
          );
        }
        if (other.kind !== "methodSignature") return false;
        if (
          (m.typeParameters?.length ?? 0) !==
          (other.typeParameters?.length ?? 0)
        )
          return false;
        if (m.parameters.length !== other.parameters.length) return false;
        const paramsMatch = m.parameters.every((p, paramIndex) => {
          const otherParam = other.parameters[paramIndex];
          if (!otherParam) return false;
          if (
            p.isRest !== otherParam.isRest ||
            p.isOptional !== otherParam.isOptional ||
            p.passing !== otherParam.passing
          ) {
            return false;
          }
          if (!p.type || !otherParam.type) return p.type === otherParam.type;
          return unifyTypeTemplate(p.type, otherParam.type, substitutions);
        });
        if (!paramsMatch) return false;
        if (!m.returnType || !other.returnType) {
          return m.returnType === other.returnType;
        }
        return unifyTypeTemplate(m.returnType, other.returnType, substitutions);
      });
    }
  }
};

export const deriveSubstitutionsFromExpectedReturn = (
  returnTemplate: IrType | undefined,
  expectedType: IrType | undefined
): Map<string, IrType> | undefined => {
  if (!returnTemplate || !expectedType) return undefined;

  const candidateQueue: IrType[] =
    expectedType.kind === "unionType"
      ? [...expectedType.types]
      : [expectedType];
  const candidates: IrType[] = [];
  const seen = new Set<string>();
  const enqueue = (candidate: IrType): void => {
    const key = stableIrTypeKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    candidateQueue.push(candidate);
  };

  while (candidateQueue.length > 0) {
    const candidate = candidateQueue.shift();
    if (!candidate) continue;
    candidates.push(candidate);

    const asyncInner = unwrapAsyncWrapperType(candidate);
    if (asyncInner) {
      enqueue(asyncInner);
    } else if (candidate.kind === "unionType") {
      for (const member of candidate.types) {
        enqueue(member);
      }
    }
  }

  let matched: Map<string, IrType> | undefined;
  for (const candidate of candidates) {
    const attempt = new Map<string, IrType>();
    if (!unifyTypeTemplate(returnTemplate, candidate, attempt)) continue;
    if (attempt.size === 0) continue;
    if (matched) {
      return undefined;
    }
    matched = attempt;
  }

  return matched;
};

export const substituteTypeParameters = (
  type: IrType | undefined,
  substitutions: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (!type) return undefined;

  switch (type.kind) {
    case "typeParameterType":
      return substitutions.get(type.name) ?? type;
    case "arrayType":
      return {
        ...type,
        elementType: substituteTypeParameters(type.elementType, substitutions)!,
      };
    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map(
          (t) => substituteTypeParameters(t, substitutions)!
        ),
      };
    case "dictionaryType":
      return {
        ...type,
        keyType: substituteTypeParameters(type.keyType, substitutions)!,
        valueType: substituteTypeParameters(type.valueType, substitutions)!,
      };
    case "referenceType":
      return {
        ...type,
        ...(type.typeArguments
          ? {
              typeArguments: type.typeArguments.map(
                (t) => substituteTypeParameters(t, substitutions)!
              ),
            }
          : {}),
      };
    case "unionType":
    case "intersectionType":
      return {
        ...type,
        types: type.types.map(
          (t) => substituteTypeParameters(t, substitutions)!
        ),
      };
    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((p) => ({
          ...p,
          type: substituteTypeParameters(p.type, substitutions),
        })),
        returnType: substituteTypeParameters(type.returnType, substitutions)!,
      };
    case "objectType":
      return {
        ...type,
        members: type.members.map((m) => {
          if (m.kind === "propertySignature") {
            return {
              ...m,
              type: substituteTypeParameters(m.type, substitutions)!,
            };
          }
          return {
            ...m,
            typeParameters: m.typeParameters?.map((tp) => ({
              ...tp,
              constraint: substituteTypeParameters(
                tp.constraint,
                substitutions
              ),
              default: substituteTypeParameters(tp.default, substitutions),
            })),
            parameters: m.parameters.map((p) => ({
              ...p,
              type: substituteTypeParameters(p.type, substitutions),
            })),
            returnType: substituteTypeParameters(m.returnType, substitutions),
          };
        }),
      };
    default:
      return type;
  }
};

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
            .replace(/^\_\_/, "")
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

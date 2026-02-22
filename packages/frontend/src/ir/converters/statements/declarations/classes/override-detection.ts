/**
 * Override detection for class members
 *
 * ALICE'S SPEC: Uses TypeSystem exclusively for declaration queries.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../../../../program-context.js";
import type { IrParameter, IrType } from "../../../../types.js";

export type OverrideInfo = {
  readonly isOverride: boolean;
  readonly isShadow: boolean;
  /**
   * Required C# accessibility for an override against a CLR base member.
   *
   * TypeScript cannot express `protected internal`, so we infer it from bindings.json.
   */
  readonly requiredAccessibility?:
    | "public"
    | "protected"
    | "internal"
    | "protected internal"
    | "private";
};

/**
 * Check if a method/property should be marked as override based on base class metadata.
 * DETERMINISTIC: Uses Binding API for symbol resolution.
 */
export const detectOverride = (
  memberName: string,
  memberKind: "method" | "property",
  superClass: ts.ExpressionWithTypeArguments | undefined,
  ctx: ProgramContext,
  parameters?: readonly IrParameter[]
): OverrideInfo => {
  if (!superClass) {
    return { isOverride: false, isShadow: false };
  }

  // DETERMINISTIC: Get base class name directly from AST
  // For simple identifiers, get the name; for qualified names, get the full path
  const baseClassName = ts.isIdentifier(superClass.expression)
    ? superClass.expression.text
    : ts.isPropertyAccessExpression(superClass.expression)
      ? getFullPropertyAccessName(superClass.expression)
      : undefined;

  if (!baseClassName) {
    return { isOverride: false, isShadow: false };
  }

  // Try to resolve the identifier to get more context
  const declId =
    ts.isIdentifier(superClass.expression) &&
    ctx.binding.resolveIdentifier(superClass.expression);

  // Get qualified name from Binding (works for both TS and tsbindgen declarations).
  const qualifiedName = declId
    ? ctx.binding.getFullyQualifiedName(declId)
    : baseClassName;

  // Check if this is a .NET type (starts with "System." or other .NET namespaces)
  const isDotNetType =
    qualifiedName?.startsWith("System.") ||
    qualifiedName?.startsWith("Microsoft.") ||
    qualifiedName?.startsWith("Tsonic.Runtime.");

  if (isDotNetType && qualifiedName) {
    return detectDotNetOverride(
      memberName,
      memberKind,
      qualifiedName,
      ctx,
      parameters
    );
  } else if (declId) {
    // ALICE'S SPEC (Phase 5): Use semantic method instead of getDeclInfo
    return ctx.typeSystem.checkTsClassMemberOverride(
      declId,
      memberName,
      memberKind
    );
  }

  return { isOverride: false, isShadow: false };
};

/**
 * Get full property access name (e.g., "System.Collections.Generic.List")
 */
const getFullPropertyAccessName = (
  expr: ts.PropertyAccessExpression
): string => {
  const parts: string[] = [expr.name.text];
  let current: ts.Expression = expr.expression;

  while (ts.isPropertyAccessExpression(current)) {
    parts.unshift(current.name.text);
    current = current.expression;
  }

  if (ts.isIdentifier(current)) {
    parts.unshift(current.text);
  }

  return parts.join(".");
};

/**
 * Detect override for .NET base classes using metadata
 */
const detectDotNetOverride = (
  memberName: string,
  memberKind: "method" | "property",
  qualifiedName: string,
  ctx: ProgramContext,
  parameters?: readonly IrParameter[]
): OverrideInfo => {
  if (memberKind === "method" && parameters) {
    const parameterTypes: string[] = [];
    for (const p of parameters) {
      const token = irTypeToDotnetSignatureType(p.type);
      if (!token) {
        return { isOverride: false, isShadow: false };
      }

      // CLR byref uses '&' in signatures; include it for ref/out/in.
      parameterTypes.push(
        p.passing === "value"
          ? token
          : token.endsWith("&")
            ? token
            : `${token}&`
      );
    }

    const modifiersKey = buildParameterModifiersKey(parameters);

    const meta = ctx.metadata.getMethodMetadata(
      qualifiedName,
      memberName,
      parameterTypes,
      modifiersKey
    );

    // If we can't deterministically resolve the overload, do not guess.
    if (!meta) return { isOverride: false, isShadow: false };

    const canOverride = meta.virtual === true && meta.sealed !== true;
    return {
      isOverride: canOverride,
      isShadow: !canOverride,
      requiredAccessibility: canOverride ? meta.visibility : undefined,
    };
  } else if (memberKind === "property") {
    // For properties, check without parameters
    const meta = ctx.metadata.getPropertyMetadata(qualifiedName, memberName);
    if (!meta) return { isOverride: false, isShadow: false };

    const canOverride = meta.virtual === true && meta.sealed !== true;
    return {
      isOverride: canOverride,
      isShadow: !canOverride,
      requiredAccessibility: canOverride ? meta.visibility : undefined,
    };
  }

  return { isOverride: false, isShadow: false };
};

const buildParameterModifiersKey = (params: readonly IrParameter[]): string => {
  const mods: Array<{ index: number; modifier: string }> = [];
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (!p) continue;
    if (p.passing === "value") continue;
    mods.push({ index: i, modifier: p.passing });
  }
  if (mods.length === 0) return "";
  return mods
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((m) => `${m.index}:${m.modifier}`)
    .join(",");
};

const irTypeToDotnetSignatureType = (
  type: IrType | undefined
): string | undefined => {
  if (!type) return undefined;

  // Signature tokens mirror tsbindgen `canonicalSignature` types:
  // - Non-generic CLR types use fully-qualified CLR names (e.g., System.String)
  // - Generic CLR types use TS surface tokens (e.g., List_1, Dictionary_2)
  // - Type parameters use their name (e.g., T)
  // - Arrays use `[]` suffix (e.g., System.Type[])
  // - Byref uses `&` suffix and is handled at the parameter level.
  switch (type.kind) {
    case "primitiveType": {
      switch (type.name) {
        case "string":
          return "System.String";
        case "number":
          return "System.Double";
        case "boolean":
          return "System.Boolean";
        case "int":
          return "System.Int32";
        case "char":
          return "System.Char";
        default:
          return undefined;
      }
    }
    case "typeParameterType":
      return type.name;
    case "arrayType": {
      const el = irTypeToDotnetSignatureType(type.elementType);
      return el ? `${el}[]` : undefined;
    }
    case "referenceType": {
      const clrName = type.resolvedClrType ?? type.typeId?.clrName;
      if (!clrName) return undefined;

      // Generic CLR type names use `\u0060` (or '`') arity suffix; signatures use Foo_1 tokens.
      if (clrName.includes("\u0060") || clrName.includes("`")) {
        const lastDot = clrName.lastIndexOf(".");
        const simple = lastDot >= 0 ? clrName.slice(lastDot + 1) : clrName;
        return simple.replace(/\u0060(\d+)/g, "_$1").replace(/`(\d+)/g, "_$1");
      }

      return clrName;
    }
    default:
      return undefined;
  }
};

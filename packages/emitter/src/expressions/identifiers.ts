/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { printType } from "../core/format/backend-ast/printer.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

/**
 * Emit an identifier as CSharpExpressionAst
 */
export const emitIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  // Special case for undefined -> default
  if (expr.name === "undefined") {
    if (
      expectedType?.kind === "typeParameterType" ||
      (expectedType?.kind === "primitiveType" &&
        expectedType.name === "undefined")
    ) {
      return [
        {
          kind: "defaultExpression",
          type: { kind: "predefinedType", keyword: "object" },
        },
        context,
      ];
    }
    return [{ kind: "defaultExpression" }, context];
  }

  // TypeScript `super` maps to C# `base` for member access/calls.
  // (`super()` constructor calls are handled separately in constructor emission.)
  if (expr.name === "super") {
    return [{ kind: "identifierExpression", identifier: "base" }, context];
  }

  // Narrowing remap for union type guards
  // - "rename": account -> account__1_3 (if-statements with temp var)
  // - "expr": account -> (account.As1()) (ternary expressions, inline)
  if (context.narrowedBindings) {
    const narrowed = context.narrowedBindings.get(expr.name);
    if (narrowed) {
      if (narrowed.kind === "rename") {
        return [
          {
            kind: "identifierExpression",
            identifier: escapeCSharpIdentifier(narrowed.name),
          },
          context,
        ];
      } else {
        // kind === "expr" - emit pre-built AST (e.g., parenthesized AsN() call)
        return [narrowed.exprAst, context];
      }
    }
  }

  // Lexical remap for locals/parameters (prevents C# CS0136 shadowing errors).
  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal) {
    return [
      { kind: "identifierExpression", identifier: remappedLocal },
      context,
    ];
  }

  // Check if this identifier is from an import
  if (context.importBindings) {
    const binding = context.importBindings.get(expr.name);
    if (binding) {
      // Imported identifier - always use fully-qualified reference
      // Use pre-computed clrName directly (all resolution done when building binding)
      if (binding.member) {
        // Value import with member - Container.member
        return [
          {
            kind: "identifierExpression",
            identifier: `${binding.clrName}.${binding.member}`,
          },
          context,
        ];
      }
      // Type, namespace, or default import - use clrName directly
      return [
        { kind: "identifierExpression", identifier: binding.clrName },
        context,
      ];
    }
  }

  // Static module members (functions/fields) in the current file's container class.
  // These are emitted with namingPolicy (e.g., `main` → `Main` under `clr`).
  const valueSymbol = context.valueSymbols?.get(expr.name);
  if (valueSymbol) {
    const memberName = escapeCSharpIdentifier(valueSymbol.csharpName);
    if (
      context.moduleStaticClassName &&
      context.className !== context.moduleStaticClassName
    ) {
      return [
        {
          kind: "identifierExpression",
          identifier: `${context.moduleStaticClassName}.${memberName}`,
        },
        context,
      ];
    }
    return [{ kind: "identifierExpression", identifier: memberName }, context];
  }

  // Use custom C# name from binding if specified (with global:: prefix)
  if (expr.csharpName && expr.resolvedAssembly) {
    const fqn = `global::${expr.resolvedAssembly}.${expr.csharpName}`;
    return [{ kind: "identifierExpression", identifier: fqn }, context];
  }

  // Use resolved binding if available (from binding manifest) with global:: prefix
  // resolvedClrType is already the full CLR type name, just add global::
  if (expr.resolvedClrType) {
    const fqn = `global::${expr.resolvedClrType}`;
    return [{ kind: "identifierExpression", identifier: fqn }, context];
  }

  // Fallback: use identifier as-is (escape C# keywords)
  return [
    {
      kind: "identifierExpression",
      identifier: escapeCSharpIdentifier(expr.name),
    },
    context,
  ];
};

/**
 * Emit type arguments as CSharpTypeAst[]
 */
export const emitTypeArgumentAsts = (
  typeArgs: readonly IrType[],
  context: EmitterContext
): [CSharpTypeAst[], EmitterContext] => {
  if (!typeArgs || typeArgs.length === 0) {
    return [[], context];
  }

  let currentContext = context;
  const typeAsts: CSharpTypeAst[] = [];

  for (const typeArg of typeArgs) {
    const [typeAst, newContext] = emitTypeAst(typeArg, currentContext);
    currentContext = newContext;
    typeAsts.push(typeAst);
  }

  return [typeAsts, currentContext];
};

/**
 * Emit type arguments as typed CSharpTypeAst array.
 * Returns empty array for empty/null type arguments.
 */
export const emitTypeArgumentsAst = (
  typeArgs: readonly IrType[],
  context: EmitterContext
): [readonly CSharpTypeAst[], EmitterContext] => {
  if (!typeArgs || typeArgs.length === 0) {
    return [[], context];
  }

  let currentContext = context;
  const typeAsts: CSharpTypeAst[] = [];

  for (const typeArg of typeArgs) {
    const [typeAst, newContext] = emitTypeAst(typeArg, currentContext);
    currentContext = newContext;
    typeAsts.push(typeAst);
  }

  return [typeAsts, currentContext];
};

/**
 * Generate specialized method/class name from type arguments
 * Example: process with [string, number] → process__string__double
 */
export const generateSpecializedName = (
  baseName: string,
  typeArgs: readonly IrType[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const typeNames: string[] = [];

  for (const typeArg of typeArgs) {
    const [typeAst, newContext] = emitTypeAst(typeArg, currentContext);
    currentContext = newContext;
    const typeName = printType(typeAst);
    // Sanitize type name for use in identifier (remove <>, ?, etc.)
    const sanitized = typeName.replace(/[<>?,\s]/g, "_").replace(/\./g, "_");
    typeNames.push(sanitized);
  }

  const specializedName = `${baseName}__${typeNames.join("__")}`;
  return [specializedName, currentContext];
};

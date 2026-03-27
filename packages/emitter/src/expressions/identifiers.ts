/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import {
  normalizeClrQualifiedName,
  stableIdentifierSuffixFromTypeAst,
} from "../core/format/backend-ast/utils.js";
import { emitTypedDefaultAst } from "../core/semantic/defaults.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  buildRuntimeSubsetExpressionAst,
  isBroadStorageTarget,
  tryEmitCollapsedStorageIdentifier,
  tryEmitImplicitNarrowedStorageIdentifier,
  tryEmitImplicitRuntimeSubsetStorageIdentifier,
  tryEmitMaterializedNarrowedIdentifier,
  tryEmitReifiedStorageIdentifier,
  tryEmitStorageCompatibleIdentifier,
  tryEmitStorageCompatibleNarrowedIdentifier,
} from "./identifier-storage.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";

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
    if (expectedType) {
      const [typeAst, nextContext] = emitTypedDefaultAst(expectedType, context);
      return [{ kind: "defaultExpression", type: typeAst }, nextContext];
    }
    return [{ kind: "defaultExpression" }, context];
  }

  // TypeScript `super` maps to C# `base` for member access/calls.
  // (`super()` constructor calls are handled separately in constructor emission.)
  if (expr.name === "super") {
    return [identifierExpression("base"), context];
  }

  // Narrowing remap for union type guards
  // - "rename": account -> account__1_3 (if-statements with temp var)
  // - "expr": account -> (account.As1()) (ternary expressions, inline)
  if (context.narrowedBindings) {
    const narrowed = context.narrowedBindings.get(expr.name);
    if (narrowed) {
      if (narrowed.kind === "rename") {
        return [
          identifierExpression(escapeCSharpIdentifier(narrowed.name)),
          context,
        ];
      } else if (narrowed.kind === "expr") {
        const storageCompatible = tryEmitStorageCompatibleNarrowedIdentifier(
          expr,
          narrowed,
          context,
          expectedType
        );
        if (storageCompatible) {
          return storageCompatible;
        }

        const materializedNarrowed = tryEmitMaterializedNarrowedIdentifier(
          narrowed,
          context,
          expectedType
        );
        if (materializedNarrowed) {
          return materializedNarrowed;
        }

        const implicitStorage = tryEmitImplicitNarrowedStorageIdentifier(
          expr,
          narrowed,
          context
        );
        if (implicitStorage) {
          return implicitStorage;
        }

        return [narrowed.exprAst, context];
      } else if (narrowed.kind === "runtimeSubset") {
        const storageCompatibleExpected = expectedType
          ? tryEmitStorageCompatibleIdentifier(expr, context, expectedType)
          : undefined;
        if (storageCompatibleExpected && expectedType) {
          return [storageCompatibleExpected, context];
        }

        const shouldPreferNarrowedSubsetTarget =
          !!narrowed.type &&
          !!expectedType &&
          (isBroadStorageTarget(expectedType, context) ||
            (willCarryAsRuntimeUnion(expectedType, context) &&
              !willCarryAsRuntimeUnion(narrowed.type, context) &&
              matchesExpectedEmissionType(
                narrowed.type,
                expectedType,
                context
              )));
        const preferredSubsetTargetType = shouldPreferNarrowedSubsetTarget
          ? narrowed.type
          : expectedType;
        const expectedSubset = expectedType
          ? buildRuntimeSubsetExpressionAst(
              expr,
              narrowed,
              context,
              preferredSubsetTargetType
            )
          : undefined;
        if (expectedSubset) {
          return expectedSubset;
        }

        const implicitStorage = tryEmitImplicitRuntimeSubsetStorageIdentifier(
          expr,
          narrowed,
          context
        );
        if (implicitStorage) {
          return implicitStorage;
        }

        // Storage-compatible shortcut is intentionally skipped here.
        // When a runtimeSubset binding is active, the variable has been
        // narrowed to a semantic subset (e.g., PathSpec slots within a
        // 5-member carrier). The raw storage identifier carries the full
        // carrier, not the subset. Using it would lose the narrowing and
        // cause incorrect carrier-shape adaptation downstream.

        const subsetAst = buildRuntimeSubsetExpressionAst(
          expr,
          narrowed,
          context
        );
        if (subsetAst) {
          return subsetAst;
        }
      }

      return [identifierExpression(escapeCSharpIdentifier(expr.name)), context];
    }
  }

  const storageFallback = tryEmitStorageCompatibleIdentifier(
    expr,
    context,
    expectedType
  );
  if (storageFallback) {
    return [storageFallback, context];
  }

  const collapsedStorage = tryEmitCollapsedStorageIdentifier(expr, context);
  if (collapsedStorage) {
    return collapsedStorage;
  }

  // Lexical remap for locals/parameters (prevents C# CS0136 shadowing errors).
  const reifiedStorage = tryEmitReifiedStorageIdentifier(
    expr,
    context,
    expectedType
  );
  if (reifiedStorage) {
    return reifiedStorage;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal) {
    return [identifierExpression(remappedLocal), context];
  }

  // Check if this identifier is from an import
  if (context.importBindings) {
    const binding = context.importBindings.get(expr.name);
    if (binding) {
      // Imported identifier - always use fully-qualified reference
      if (binding.kind === "value") {
        // Value import with member - Container.member
        return [
          identifierExpression(`${binding.clrName}.${binding.member}`),
          context,
        ];
      }
      if (binding.kind === "type") {
        return [
          {
            kind: "typeReferenceExpression",
            type: binding.typeAst,
          },
          context,
        ];
      }
      // Namespace import - use precomputed container name directly
      return [identifierExpression(binding.clrName), context];
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
      const moduleNamespace =
        context.moduleNamespace ?? context.options.rootNamespace;
      const containerPrefix = moduleNamespace.startsWith("global::")
        ? moduleNamespace
        : `global::${moduleNamespace}`;
      return [
        identifierExpression(
          `${containerPrefix}.${context.moduleStaticClassName}.${memberName}`
        ),
        context,
      ];
    }
    return [identifierExpression(memberName), context];
  }

  // Use custom C# name from binding if specified (with global:: prefix)
  if (expr.csharpName && expr.resolvedAssembly) {
    const fqn = `global::${expr.resolvedAssembly}.${expr.csharpName}`;
    return [identifierExpression(fqn), context];
  }

  // Use resolved binding if available (from binding manifest) with global:: prefix.
  // Normalize nested CLR type syntax (Outer+Inner`1) before emitting.
  if (expr.resolvedClrType) {
    const fqn = normalizeClrQualifiedName(expr.resolvedClrType, true);
    return [identifierExpression(fqn), context];
  }

  // Fallback: use identifier as-is (escape C# keywords)
  return [identifierExpression(escapeCSharpIdentifier(expr.name)), context];
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
    typeNames.push(stableIdentifierSuffixFromTypeAst(typeAst));
  }

  const specializedName = `${baseName}__${typeNames.join("__")}`;
  return [specializedName, currentContext];
};

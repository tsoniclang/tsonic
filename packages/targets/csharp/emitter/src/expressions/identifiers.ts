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
import { resolveModuleValueSymbolReferenceAst } from "./identifier-references.js";
import { emitTypedDefaultAst } from "../core/semantic/defaults.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  buildRuntimeSubsetExpressionAst,
  tryEmitExactStorageCompatibleNarrowedIdentifier,
  isBroadStorageTarget,
  tryEmitCollapsedStorageIdentifier,
  tryEmitImplicitNarrowedStorageIdentifier,
  tryEmitImplicitRuntimeSubsetStorageIdentifier,
  tryEmitMaterializedNarrowedIdentifier,
  matchesEmittedStorageSurface,
  tryEmitReifiedStorageIdentifier,
  tryEmitRuntimeSubsetMemberProjectionIdentifier,
  tryEmitStorageCompatibleIdentifier,
  tryEmitStorageCompatibleNarrowedIdentifier,
} from "./identifier-storage.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { stripNullish } from "../core/semantic/type-resolution.js";
import { runtimeUnionAliasReferencesMatch } from "../core/semantic/runtime-union-alias-identity.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { buildRuntimeUnionLayout } from "../core/semantic/runtime-unions.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import {
  isExpectedIntegralIrType,
  maybeCastNumericToExpectedJsNumberAst,
  maybeCastNumericToExpectedIntegralAst,
} from "./post-emission-adaptation.js";
import { resolveCoreTargetTypeName } from "../core/semantic/target-symbols.js";

/**
 * Emit an identifier as CSharpExpressionAst
 */
export const emitIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const maybeWrapLocalNumericCast = (
    identifierAst: CSharpExpressionAst,
    currentContext: EmitterContext
  ): [CSharpExpressionAst, EmitterContext] => {
    if (!expectedType) {
      return [identifierAst, currentContext];
    }

    const storageType = currentContext.localValueTypes?.get(expr.name);
    if (!storageType) {
      return [identifierAst, currentContext];
    }

    if (isExpectedIntegralIrType(expectedType, currentContext)) {
      return maybeCastNumericToExpectedIntegralAst(
        identifierAst,
        storageType,
        currentContext,
        expectedType
      );
    }

    return maybeCastNumericToExpectedJsNumberAst(
      identifierAst,
      storageType,
      currentContext,
      expectedType
    );
  };
  const maybeMaterializeValueReference = (
    identifierAst: CSharpExpressionAst,
    currentContext: EmitterContext
  ): [CSharpExpressionAst, EmitterContext] => {
    if (!expectedType || !expr.inferredType) {
      return [identifierAst, currentContext];
    }
    const [expectedRuntimeLayout] = buildRuntimeUnionLayout(
      expectedType,
      currentContext,
      emitTypeAst
    );
    if (expectedRuntimeLayout) {
      return [identifierAst, currentContext];
    }

    return materializeDirectNarrowingAst(
      identifierAst,
      expr.inferredType,
      expectedType,
      currentContext
    );
  };

  // Special case for undefined -> default
  if (expr.name === "undefined") {
    if (
      expectedType?.kind === "primitiveType" &&
      expectedType.name === "undefined"
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

  // Imported identifiers are declarations in another module, not locals. Resolve
  // them before storage-compatible local reuse so imported constants/functions
  // stay fully qualified even when their inferred type matches the call context.
  if (context.importBindings) {
    const binding = context.importBindings.get(expr.name);
    if (binding) {
      if (binding.kind === "value") {
        return maybeMaterializeValueReference(
          identifierExpression(`${binding.clrName}.${binding.member}`),
          context
        );
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
      return [identifierExpression(binding.clrName), context];
    }
  }

  const moduleValueReference = resolveModuleValueSymbolReferenceAst(
    expr.name,
    context
  );
  if (moduleValueReference) {
    return maybeMaterializeValueReference(moduleValueReference, context);
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
        const exactStorageCompatible =
          tryEmitExactStorageCompatibleNarrowedIdentifier(
            expr,
            narrowed,
            context,
            expectedType
          );
        if (exactStorageCompatible) {
          return exactStorageCompatible;
        }

        const storageCompatible = tryEmitStorageCompatibleNarrowedIdentifier(
          expr,
          narrowed,
          context,
          expectedType
        );
        if (
          storageCompatible &&
          expectedType &&
          isBroadStorageTarget(expectedType, context)
        ) {
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

        if (storageCompatible) {
          return storageCompatible;
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
        const [sameSourceCarrierSurface, sourceCarrierContext] =
          expectedType && narrowed.sourceType
            ? matchesEmittedStorageSurface(
                stripNullish(narrowed.sourceType),
                expectedType,
                context
              )
            : [false, context];
        const sameSourceCarrierAlias =
          !!expectedType &&
          !!narrowed.sourceType &&
          runtimeUnionAliasReferencesMatch(
            stripNullish(narrowed.sourceType),
            stripNullish(expectedType),
            context
          );
        const localStorageType = context.localValueTypes?.get(expr.name);
        const localStorageAlreadyCarriesExpectedTarget =
          !!expectedType &&
          !!localStorageType &&
          (willCarryAsRuntimeUnion(stripNullish(localStorageType), context) ||
            runtimeUnionAliasReferencesMatch(
              stripNullish(localStorageType),
              stripNullish(expectedType),
              context
            ));
        const canReuseOriginalCarrierForExpectedTarget =
          !!expectedType &&
          !!narrowed.sourceType &&
          localStorageAlreadyCarriesExpectedTarget &&
          !isBroadStorageTarget(expectedType, context) &&
          (sameSourceCarrierSurface || sameSourceCarrierAlias);
        if (canReuseOriginalCarrierForExpectedTarget) {
          const originalCarrier =
            narrowed.storageExprAst ??
            identifierExpression(
              context.localNameMap?.get(expr.name) ??
                escapeCSharpIdentifier(expr.name)
            );
          return [originalCarrier, sourceCarrierContext];
        }

        const directMemberProjection =
          tryEmitRuntimeSubsetMemberProjectionIdentifier(
            expr,
            narrowed,
            context,
            expectedType
          );
        if (directMemberProjection) {
          return directMemberProjection;
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

  const contextualReturnStorageFallback =
    expectedType === undefined && context.returnType
      ? tryEmitStorageCompatibleIdentifier(expr, context, context.returnType)
      : undefined;
  if (contextualReturnStorageFallback) {
    return [contextualReturnStorageFallback, context];
  }

  const storageFallback = tryEmitStorageCompatibleIdentifier(
    expr,
    context,
    expectedType
  );
  if (storageFallback) {
    return maybeWrapLocalNumericCast(storageFallback, context);
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

  const collapsedStorage =
    expectedType === undefined
      ? tryEmitCollapsedStorageIdentifier(expr, context)
      : undefined;
  if (collapsedStorage) {
    return collapsedStorage;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal) {
    return maybeWrapLocalNumericCast(
      identifierExpression(remappedLocal),
      context
    );
  }

  // Use target member name from binding if specified (with global:: prefix)
  if (expr.providerMemberName && expr.providerOwnerIdentity) {
    const fqn = `global::${expr.providerOwnerIdentity}.${expr.providerMemberName}`;
    return maybeMaterializeValueReference(identifierExpression(fqn), context);
  }

  // Use resolved binding if available (from binding manifest) with global:: prefix.
  // Normalize nested CLR type syntax (Outer+Inner`1) before emitting.
  if (expr.providerQualifiedName) {
    const fqn = normalizeClrQualifiedName(
      resolveCoreTargetTypeName(expr.providerQualifiedName) ??
        expr.providerQualifiedName,
      true
    );
    return [identifierExpression(fqn), context];
  }

  // Fallback: use identifier as-is (escape C# keywords)
  return maybeWrapLocalNumericCast(
    identifierExpression(escapeCSharpIdentifier(expr.name)),
    context
  );
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

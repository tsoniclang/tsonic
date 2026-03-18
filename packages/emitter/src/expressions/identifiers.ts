/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import {
  stableIdentifierSuffixFromTypeAst,
  stableTypeKeyFromAst,
} from "../core/format/backend-ast/utils.js";
import { emitTypedDefaultAst } from "../core/semantic/defaults.js";
import {
  matchesExpectedEmissionType,
  requiresValueTypeMaterialization,
} from "../core/semantic/expected-type-matching.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import {
  RuntimeMaterializationSourceFrame,
  tryBuildRuntimeMaterializationAst,
  tryBuildRuntimeReificationPlan,
} from "../core/semantic/runtime-reification.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

const isBroadStorageTarget = (
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!expectedType) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(expectedType), context);
  return (
    resolved.kind === "unknownType" ||
    resolved.kind === "anyType" ||
    resolved.kind === "objectType" ||
    (resolved.kind === "referenceType" && resolved.name === "object")
  );
};

const buildRuntimeSubsetExpressionAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceType = narrowed.sourceType ?? expr.inferredType;
  const subsetType = narrowed.type;
  if (!sourceType || !subsetType) {
    return undefined;
  }

  const sourceFrame: RuntimeMaterializationSourceFrame | undefined =
    narrowed.sourceMembers &&
    narrowed.sourceCandidateMemberNs &&
    narrowed.sourceMembers.length === narrowed.sourceCandidateMemberNs.length
      ? {
          members: narrowed.sourceMembers,
          candidateMemberNs: narrowed.sourceCandidateMemberNs,
        }
      : undefined;

  return tryBuildRuntimeMaterializationAst(
    identifierExpression(escapeCSharpIdentifier(expr.name)),
    sourceType,
    subsetType,
    context,
    emitTypeAst,
    new Set(narrowed.runtimeMemberNs),
    sourceFrame
  );
};

const tryEmitStorageCompatibleIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): CSharpExpressionAst | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  if (isBroadStorageTarget(expectedType, context)) {
    return identifierExpression(remappedLocal);
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  if (
    !isBroadStorageTarget(expectedType, context) &&
    matchesExpectedEmissionType(effectiveType, expectedType, context)
  ) {
    return undefined;
  }

  if (!matchesExpectedEmissionType(storageType, expectedType, context)) {
    return undefined;
  }

  return identifierExpression(remappedLocal);
};

const tryEmitCollapsedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  if (!effectiveType) {
    return undefined;
  }

  if (matchesExpectedEmissionType(storageType, effectiveType, context)) {
    return [identifierExpression(remappedLocal), context];
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    effectiveType,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  return [identifierExpression(remappedLocal), nextContext];
};

const tryEmitImplicitNarrowedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.storageExprAst || !narrowed.type) {
    return undefined;
  }

  const storageType = context.localValueTypes?.get(expr.name);
  if (!storageType) {
    return undefined;
  }

  if (!matchesExpectedEmissionType(storageType, narrowed.type, context)) {
    const [sameSurface, nextContext] = matchesEmittedStorageSurface(
      storageType,
      narrowed.type,
      context
    );
    if (!sameSurface) {
      return undefined;
    }
    return [narrowed.storageExprAst, nextContext];
  }

  return [narrowed.storageExprAst, context];
};

const tryEmitImplicitRuntimeSubsetStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.type) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  if (matchesExpectedEmissionType(storageType, narrowed.type, context)) {
    return [identifierExpression(remappedLocal), context];
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    narrowed.type,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  return [identifierExpression(remappedLocal), nextContext];
};

const tryEmitReifiedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  if (!matchesExpectedEmissionType(effectiveType, expectedType, context)) {
    return undefined;
  }

  if (matchesExpectedEmissionType(storageType, expectedType, context)) {
    return undefined;
  }

  const plan = tryBuildRuntimeReificationPlan(
    identifierExpression(remappedLocal),
    expectedType,
    context,
    emitTypeAst
  );
  if (!plan) {
    return undefined;
  }

  return [plan.value, plan.context];
};

const tryEmitStorageCompatibleNarrowedIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.storageExprAst || !narrowed.type) {
    return undefined;
  }

  const storageType = context.localValueTypes?.get(expr.name);
  if (!storageType) {
    return undefined;
  }

  const targetType = expectedType ?? narrowed.type;
  if (!matchesExpectedEmissionType(storageType, targetType, context)) {
    const [sameSurface, nextContext] = matchesEmittedStorageSurface(
      storageType,
      targetType,
      context
    );
    if (!sameSurface) {
      return undefined;
    }
    return [narrowed.storageExprAst, nextContext];
  }

  return [narrowed.storageExprAst, context];
};

const tryEmitMaterializedNarrowedIdentifier = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const effectiveType = narrowed.type ?? narrowed.sourceType;
  if (!effectiveType) {
    return undefined;
  }

  return materializeDirectNarrowingAst(
    narrowed.exprAst,
    effectiveType,
    expectedType,
    context
  );
};

const matchesEmittedStorageSurface = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): [boolean, EmitterContext] => {
  if (!actualType || !expectedType) {
    return [false, context];
  }

  if (requiresValueTypeMaterialization(actualType, expectedType, context)) {
    return [false, context];
  }

  const strippedActual = stripNullish(actualType);
  const strippedExpected = stripNullish(expectedType);
  const [actualTypeAst, actualTypeContext] = emitTypeAst(
    strippedActual,
    context
  );
  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    strippedExpected,
    actualTypeContext
  );

  return [
    stableTypeKeyFromAst(actualTypeAst) ===
      stableTypeKeyFromAst(expectedTypeAst),
    expectedTypeContext,
  ];
};

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
      // Storage-compatible fast paths must NOT bypass runtimeSubset
      // narrowing. When a branch context carries a runtimeSubset binding,
      // the variable is semantically narrowed to a subset of the carrier
      // (e.g., first: PathSpec slots within Union<5 members>). Emitting
      // the raw storage identifier would lose that subset information and
      // cause incorrect carrier-shape adaptation downstream.
      if (narrowed.kind !== "runtimeSubset") {
        const storageFallback = tryEmitStorageCompatibleIdentifier(
          expr,
          context,
          expectedType
        );
        if (storageFallback) {
          return [storageFallback, context];
        }

        const collapsedStorage = tryEmitCollapsedStorageIdentifier(
          expr,
          context
        );
        if (collapsedStorage) {
          return collapsedStorage;
        }
      }

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
      return [
        identifierExpression(`${context.moduleStaticClassName}.${memberName}`),
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

  // Use resolved binding if available (from binding manifest) with global:: prefix
  // resolvedClrType is already the full CLR type name, just add global::
  if (expr.resolvedClrType) {
    const fqn = `global::${expr.resolvedClrType}`;
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

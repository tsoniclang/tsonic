import type { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { normalizeRuntimeStorageType } from "../semantic/storage-types.js";

export type AllocatedLocalName = {
  readonly originalName: string;
  readonly emittedName: string;
  readonly context: EmitterContext;
};

export const reserveLocalName = (
  emittedName: string,
  context: EmitterContext
): EmitterContext => {
  const next = new Set(context.usedLocalNames ?? []);
  next.add(emittedName);
  return { ...context, usedLocalNames: next };
};

/**
 * Allocate a unique C# local identifier for a TypeScript local name.
 *
 * This is intentionally global-within-method (not just lexical-scope) to avoid C# CS0136:
 *   - TS allows: { const x = ... } const x = ...
 *   - C# forbids declaring `x` in the outer scope after it appeared in a nested scope.
 *
 * We keep TS lexical scoping via `localNameMap`, but reserve emitted names via `usedLocalNames`.
 */
export const allocateLocalName = (
  originalName: string,
  context: EmitterContext
): AllocatedLocalName => {
  const used = context.usedLocalNames ?? new Set<string>();

  // Fast path: base name is unused.
  const baseEmitted = escapeCSharpIdentifier(originalName);
  if (!used.has(baseEmitted)) {
    const ctx = reserveLocalName(baseEmitted, context);
    return { originalName, emittedName: baseEmitted, context: ctx };
  }

  // Slow path: pick the smallest deterministic suffix.
  let suffix = 1;
  while (true) {
    const candidate = escapeCSharpIdentifier(`${originalName}__${suffix}`);
    if (!used.has(candidate)) {
      const ctx = reserveLocalName(candidate, context);
      return { originalName, emittedName: candidate, context: ctx };
    }
    suffix++;
  }
};

export const registerLocalName = (
  originalName: string,
  emittedName: string,
  context: EmitterContext
): EmitterContext => {
  const nextMap = new Map(context.localNameMap ?? []);
  nextMap.set(originalName, emittedName);
  return { ...context, localNameMap: nextMap };
};

/**
 * Register both semantic and storage types for a local symbol.
 *
 * Semantic type preserves alias identity, union structure, and type-parameter
 * shapes exactly as authored in the frontend IR. Storage type is the
 * CLR-normalized carrier used for C# declarations and runtime dispatch.
 */
export const registerLocalSymbolTypes = (
  originalName: string,
  semanticType: IrType | undefined,
  storageType: IrType | undefined,
  context: EmitterContext
): EmitterContext => {
  const hadSemantic = context.localSemanticTypes?.has(originalName) ?? false;
  const hadStorage = context.localValueTypes?.has(originalName) ?? false;

  // Nothing to write and nothing to shadow — no-op.
  if (!semanticType && !storageType && !hadSemantic && !hadStorage) {
    return context;
  }

  // Always derive a new map so that an undefined channel clears any
  // outer binding for this name rather than letting it bleed through.
  const nextSemantic = new Map(context.localSemanticTypes ?? []);
  if (semanticType) {
    nextSemantic.set(originalName, semanticType);
  } else {
    nextSemantic.delete(originalName);
  }

  const nextStorage = new Map(context.localValueTypes ?? []);
  if (storageType) {
    nextStorage.set(originalName, storageType);
  } else {
    nextStorage.delete(originalName);
  }

  return {
    ...context,
    localSemanticTypes: nextSemantic,
    localValueTypes: nextStorage,
  };
};

/**
 * Register the same type as both semantic and storage for a local symbol.
 *
 * Used for cases where the authored type and CLR storage type are identical
 * (e.g., for-in keys are always `string` in both channels).
 */
export const registerLocalFixedType = (
  originalName: string,
  type: IrType,
  context: EmitterContext
): EmitterContext =>
  registerLocalSymbolTypes(originalName, type, type, context);

/**
 * Register a local symbol from its semantic (frontend IR) type.
 *
 * Storage type is derived automatically via normalizeRuntimeStorageType.
 * Falls back to the semantic type itself when normalization returns undefined.
 *
 * Use this for parameters and pattern bindings where the authored type is
 * the single source of truth and storage is purely derived.
 */
export const registerLocalSemanticType = (
  originalName: string,
  semanticType: IrType | undefined,
  context: EmitterContext
): EmitterContext => {
  if (!semanticType)
    return registerLocalSymbolTypes(
      originalName,
      undefined,
      undefined,
      context
    );
  const storageType =
    normalizeRuntimeStorageType(semanticType, context) ?? semanticType;
  return registerLocalSymbolTypes(
    originalName,
    semanticType,
    storageType,
    context
  );
};

/**
 * Emit a local/parameter identifier using lexical remaps (CS0136 shadowing avoidance).
 *
 * This intentionally does not consult import bindings or valueSymbols: it is only for
 * identifiers that are known to refer to locals/parameters in the current scope.
 */
export const emitRemappedLocalName = (
  originalName: string,
  context: EmitterContext
): string =>
  context.localNameMap?.get(originalName) ??
  escapeCSharpIdentifier(originalName);

import { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

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

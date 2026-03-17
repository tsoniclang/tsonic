/**
 * Reference-type names that are allowed to remain unresolved in IR because
 * the emitter/runtime handle them as builtins or the compiler synthesizes them
 * during inference/lowering.
 *
 * This list exists to keep the soundness gate aligned with the emitter's
 * builtin type handling. If a reference type name can legally reach emission
 * without an import/local declaration, it must be listed here.
 */

export const KNOWN_BUILTIN_REFERENCE_TYPES = new Set([
  "Array",
  "ReadonlyArray",
  "ArrayLike",
  "Promise",
  "PromiseLike",
  "Iterable",
  "IterableIterator",
  "AsyncIterable",
  "AsyncIterableIterator",
  "Generator",
  "AsyncGenerator",
  "IteratorResult",
  "Error",
  "Object",
  "IntPtr",
  "UIntPtr",
]);

export const isKnownBuiltinReferenceType = (name: string): boolean =>
  KNOWN_BUILTIN_REFERENCE_TYPES.has(name);

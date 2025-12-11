/**
 * Centralized list of unsupported TypeScript utility types
 *
 * These utility types internally use mapped or conditional types which are not
 * supported in Tsonic. They are detected by name in TypeReferenceNode validation.
 *
 * Note: This only applies to the built-in utility types from TypeScript's lib.
 * User-defined types with these names (without type arguments) are allowed.
 */

/**
 * Mapped-type utility types (TSN7406)
 *
 * SUPPORTED (expanded at compile time for concrete types):
 * - Partial<T>   → { [P in keyof T]?: T[P] }
 * - Required<T>  → { [P in keyof T]-?: T[P] }
 * - Readonly<T>  → { readonly [P in keyof T]: T[P] }
 * - Pick<T, K>   → { [P in K]: T[P] }
 * - Omit<T, K>   → { [P in Exclude<keyof T, K>]: T[P] }
 *
 * Note: Record<K, V> is handled separately (allowed when K is string, TSN7413 otherwise)
 * Note: ReadonlyArray<T> is NOT a mapped type - it maps to IReadOnlyList<T> and is supported
 */
export const UNSUPPORTED_MAPPED_UTILITY_TYPES = new Set<string>([
  // Partial, Required, Readonly, Pick, Omit are now supported
  // They are expanded to IrObjectType in type-converter/utility-types.ts
]);

/**
 * Conditional-type utility types (TSN7407)
 *
 * SUPPORTED (expanded at compile time for concrete types):
 * - Extract<T, U>    → T extends U ? T : never
 * - Exclude<T, U>    → T extends U ? never : T
 * - NonNullable<T>   → T & {}  (filters null/undefined from unions)
 * - ReturnType<T>    → T extends (...args: any) => infer R ? R : any
 * - Parameters<T>    → T extends (...args: infer P) => any ? P : never
 * - Awaited<T>       → T extends PromiseLike<infer U> ? Awaited<U> : T
 *
 * UNSUPPORTED (require constructor introspection):
 * - ConstructorParameters → ConstructorType extends abstract new (...args: infer P) => any ? P : never
 * - InstanceType<T>       → T extends abstract new (...args: any) => infer R ? R : any
 */
export const UNSUPPORTED_CONDITIONAL_UTILITY_TYPES = new Set([
  "ConstructorParameters",
  "InstanceType",
]);

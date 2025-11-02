/**
 * Marker type for C# struct emission
 *
 * TypeScript classes or interfaces that extend/implement this marker
 * will be emitted as C# structs instead of classes.
 *
 * @example
 * ```typescript
 * interface Point extends struct {
 *   x: number;
 *   y: number;
 * }
 * // Emits: public struct Point { public double x; public double y; }
 * ```
 */
declare namespace Tsonic {
  interface Struct {
    readonly __brand: "struct";
  }
}

export type struct = Tsonic.Struct;

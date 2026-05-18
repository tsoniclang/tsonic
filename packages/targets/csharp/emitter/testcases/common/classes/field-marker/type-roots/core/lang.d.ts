declare module "@tsonic/core/lang.js" {
  export declare function asinterface<T>(value: object): T;

  /**
   * Marker type: emit a TypeScript class property as a C# field (no accessors).
   *
   * @example
   * ```ts
   * import type { field } from "@tsonic/core/lang.js";
   *
   * class User {
   *   private email: field<string> = "";
   * }
   * ```
   */
  export type field<T> = T;
}

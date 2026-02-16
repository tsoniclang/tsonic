declare module "@tsonic/core/lang.js" {
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

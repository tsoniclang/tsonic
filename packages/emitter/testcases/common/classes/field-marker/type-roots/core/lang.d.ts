declare module "@tsonic/core/lang.js" {
  export type JsPrimitive = string | number | boolean | bigint | symbol;
  export type JsValue = object | JsPrimitive | null;

  export declare function asinterface<T>(value: JsValue): T;

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

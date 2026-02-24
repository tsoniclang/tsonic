/**
 * BackendAdapter — maps IR types to target-language representations.
 *
 * Plan-black: type-only forward declaration. No code imports this.
 * Plan-beta: C# adapter maps IrType → C# type strings,
 *            future backends provide their own adapters.
 */

import type { IrType } from "@tsonic/frontend";

/**
 * Maps an IR type to a target-language type string.
 */
export type TypeMapper = {
  /**
   * Convert an IR type to a target-language type name.
   * Returns undefined if the type has no direct mapping.
   */
  readonly mapType: (irType: IrType) => string | undefined;

  /**
   * Convert an IR primitive to a target-language primitive name.
   * E.g., "int32" → "int" (C#), "int32" → "i32" (Rust)
   */
  readonly mapPrimitive: (primitiveName: string) => string | undefined;

  /**
   * Map a fully-qualified CLR name to the target-language equivalent.
   * E.g., "System.Collections.Generic.List`1" → "List<T>" (C#)
   */
  readonly mapQualifiedName: (fqn: string) => string | undefined;
};

/**
 * Full backend adapter combining type mapping with emission utilities.
 */
export type BackendAdapter = {
  readonly typeMapper: TypeMapper;
  readonly backendName: string;
};

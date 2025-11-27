/**
 * Object type emission
 *
 * IrObjectType represents anonymous object types like `{ x: number }`.
 * These should be caught by frontend validation (TSN7403) and never reach the emitter.
 *
 * Named types (interfaces, type aliases, classes) become IrReferenceType instead.
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";

/**
 * Emit object types
 *
 * ICE: This should never be called. Frontend validation (TSN7403) should
 * reject anonymous object types. If we reach here, validation has a gap.
 */
export const emitObjectType = (
  _type: Extract<IrType, { kind: "objectType" }>,
  _context: EmitterContext
): [string, EmitterContext] => {
  // ICE: Frontend validation (TSN7403) should have caught this.
  throw new Error(
    "ICE: Anonymous object type reached emitter - validation missed TSN7403"
  );
};

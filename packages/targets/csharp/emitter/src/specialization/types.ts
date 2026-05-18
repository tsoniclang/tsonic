/**
 * Type definitions for specialization system
 */

import {
  IrFunctionDeclaration,
  IrClassDeclaration,
  IrType,
} from "@tsonic/frontend";

/**
 * Specialization request - tracks a function/class that needs a specialized version
 */
export type SpecializationRequest = {
  readonly kind: "function" | "class";
  readonly name: string;
  readonly typeArguments: readonly IrType[];
  readonly declaration: IrFunctionDeclaration | IrClassDeclaration;
};

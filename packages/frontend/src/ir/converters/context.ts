/**
 * ConverterContext — Re-exports ProgramContext for backward compatibility
 *
 * Phase 5 Step 4: ConverterContext is now an alias for ProgramContext.
 * All converters use ProgramContext, but we keep ConverterContext as an alias
 * to avoid breaking existing code during migration.
 */

import type { ProgramContext } from "../program-context.js";

/**
 * ConverterContext is an alias for ProgramContext.
 *
 * Use ProgramContext directly in new code.
 */
export type ConverterContext = ProgramContext;

/**
 * Re-export ProgramContext for direct use.
 */
export type { ProgramContext } from "../program-context.js";

/**
 * Re-export createProgramContext for direct use.
 */
export { createProgramContext } from "../program-context.js";

/**
 * Create a ConverterContext from individual components.
 *
 * @deprecated Use createProgramContext instead.
 */
export const createConverterContext = (params: {
  binding: import("../binding/index.js").Binding;
  typeSystem: import("../type-system/type-system.js").TypeSystem;
  metadata: import("../../dotnet-metadata.js").DotnetMetadataRegistry;
  bindings: import("../../program/bindings.js").BindingRegistry;
  clrResolver: import("../../resolver/clr-bindings-resolver.js").ClrBindingsResolver;
}): ConverterContext => ({
  binding: params.binding,
  typeSystem: params.typeSystem,
  metadata: params.metadata,
  bindings: params.bindings,
  clrResolver: params.clrResolver,
});

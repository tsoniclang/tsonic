/**
 * ConverterContext — Shared context for IR converters
 *
 * This context object carries shared resources through the converter chain,
 * eliminating the need to pass individual parameters like binding, typeSystem,
 * metadata registry, etc.
 *
 * Part of Alice's TypeSystem migration (Step 7b).
 */

import type { Binding } from "../binding/index.js";
import type { TypeSystem } from "../type-system/type-system.js";
import type { DotnetMetadataRegistry } from "../../dotnet-metadata.js";
import type { BindingRegistry } from "../../program/bindings.js";
import type { ClrBindingsResolver } from "../../resolver/clr-bindings-resolver.js";

/**
 * Context object passed through all IR converters.
 *
 * Contains all shared resources needed for type conversion and code generation.
 * Converters receive this context as the first parameter (after the AST node).
 */
export type ConverterContext = {
  /**
   * Binding layer for symbol resolution.
   *
   * Provides resolveIdentifier, resolveCallSignature, etc.
   */
  readonly binding: Binding;

  /**
   * TypeSystem for all type queries (Alice's spec).
   *
   * This is the ONLY source for type information. Converters should use
   * TypeSystem methods instead of accessing TypeRegistry/NominalEnv directly.
   */
  readonly typeSystem: TypeSystem;

  /**
   * .NET metadata registry for imported types.
   */
  readonly metadata: DotnetMetadataRegistry;

  /**
   * CLR bindings from tsbindgen.
   */
  readonly bindings: BindingRegistry;

  /**
   * CLR namespace resolver for import-driven discovery.
   */
  readonly clrResolver: ClrBindingsResolver;
};

/**
 * Create a ConverterContext from individual components.
 */
export const createConverterContext = (params: {
  binding: Binding;
  typeSystem: TypeSystem;
  metadata: DotnetMetadataRegistry;
  bindings: BindingRegistry;
  clrResolver: ClrBindingsResolver;
}): ConverterContext => ({
  binding: params.binding,
  typeSystem: params.typeSystem,
  metadata: params.metadata,
  bindings: params.bindings,
  clrResolver: params.clrResolver,
});

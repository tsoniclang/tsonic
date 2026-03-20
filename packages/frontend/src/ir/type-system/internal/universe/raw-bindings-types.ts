/**
 * Type Universe — Raw Bindings JSON Types & Factory Functions
 *
 * Raw JSON type shapes matching tsbindgen <Namespace>/bindings.json,
 * factory functions for TypeId creation, and primitive ↔ nominal mappings.
 */

import type { IrParameter, IrType } from "../../../types/index.js";
import type { TypeId } from "./catalog-types.js";

// ═══════════════════════════════════════════════════════════════════════════
// RAW JSON TYPES — Shapes matching tsbindgen <Namespace>/bindings.json
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw type entry from bindings.json.
 *
 * This is a superset of the historical metadata.json + bindings.json data:
 * - Type shape/kind/accessibility for the CLR type catalog
 * - Member signature metadata for semantic typing
 * - Binding target metadata (assembly/type/member) for codegen
 *
 * IMPORTANT: No `tsEmitName` fields exist. TS names are derived deterministically
 * from CLR reflection names (generics + nested types) and member CLR names.
 */
export type RawBindingsType = {
  readonly stableId: string;
  readonly clrName: string;
  readonly kind: string;
  readonly accessibility: string;
  readonly isAbstract: boolean;
  readonly isSealed: boolean;
  readonly isStatic: boolean;
  readonly arity: number;
  readonly typeParameters?: readonly string[];
  readonly methods: readonly RawBindingsMethod[];
  readonly properties: readonly RawBindingsProperty[];
  readonly fields: readonly RawBindingsField[];
  readonly events?: readonly unknown[];
  readonly constructors: readonly RawBindingsConstructor[];
  readonly baseType?: RawBindingsHeritageType;
  readonly interfaces?: readonly RawBindingsHeritageType[];
  readonly assemblyName?: string;
  readonly metadataToken?: number;
};

export type RawBindingsHeritageType = {
  readonly stableId: string;
  readonly clrName: string;
  readonly typeArguments?: readonly string[];
};

export type RawBindingsMethod = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly semanticSignature?: {
    readonly typeParameters?: readonly string[];
    readonly parameters: readonly IrParameter[];
    readonly returnType?: IrType;
  };
  readonly provenance?: string;
  readonly emitScope?: string;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isSealed: boolean;
  readonly arity: number;
  readonly parameterCount: number;
  readonly isExtensionMethod: boolean;
  readonly sourceInterface?: string;
  readonly declaringClrType?: string;
  readonly declaringAssemblyName?: string;
  readonly parameterModifiers?: readonly {
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }[];
  readonly metadataToken?: number;
};

export type RawBindingsProperty = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly semanticType?: IrType;
  readonly semanticOptional?: boolean;
  readonly provenance?: string;
  readonly emitScope?: string;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isIndexer: boolean;
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
  readonly declaringClrType?: string;
  readonly declaringAssemblyName?: string;
  readonly metadataToken?: number;
};

export type RawBindingsField = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly semanticType?: IrType;
  readonly semanticOptional?: boolean;
  readonly isStatic: boolean;
  readonly isReadOnly: boolean;
  readonly isLiteral: boolean;
  readonly declaringClrType?: string;
  readonly declaringAssemblyName?: string;
  readonly metadataToken?: number;
};

export type RawBindingsConstructor = {
  readonly normalizedSignature: string;
  readonly isStatic: boolean;
  readonly parameterCount: number;
};

export type RawBindingsFile = {
  readonly namespace: string;
  readonly contributingAssemblies?: readonly string[];
  readonly dotnetVersion?: string;
  readonly types: readonly RawBindingsType[];
};

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a TypeId from components.
 */
export const makeTypeId = (
  stableId: string,
  clrName: string,
  assemblyName: string,
  tsName: string
): TypeId => ({
  stableId,
  clrName,
  assemblyName,
  tsName,
});

/**
 * Parse a stableId into assemblyName and clrName.
 */
export const parseStableId = (
  stableId: string
): { assemblyName: string; clrName: string } | undefined => {
  const colonIndex = stableId.indexOf(":");
  if (colonIndex === -1) return undefined;
  return {
    assemblyName: stableId.slice(0, colonIndex),
    clrName: stableId.slice(colonIndex + 1),
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVE ↔ NOMINAL MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapping from TS primitive type names to their CLR stableIds.
 *
 * This enables normalizing `primitiveType("string")` to the canonical
 * `System.String` nominal type for member lookups.
 */
export const PRIMITIVE_TO_STABLE_ID: ReadonlyMap<string, string> = new Map([
  ["string", "System.Private.CoreLib:System.String"],
  ["number", "System.Private.CoreLib:System.Double"],
  ["int", "System.Private.CoreLib:System.Int32"],
  ["boolean", "System.Private.CoreLib:System.Boolean"],
  ["char", "System.Private.CoreLib:System.Char"],
]);

/**
 * Mapping from CLR stableIds back to TS primitive type names.
 *
 * This enables the emitter to use primitive syntax when appropriate.
 */
export const STABLE_ID_TO_PRIMITIVE: ReadonlyMap<string, string> = new Map([
  ["System.Private.CoreLib:System.String", "string"],
  ["System.Private.CoreLib:System.Double", "number"],
  ["System.Private.CoreLib:System.Int32", "int"],
  ["System.Private.CoreLib:System.Boolean", "boolean"],
  ["System.Private.CoreLib:System.Char", "char"],
]);

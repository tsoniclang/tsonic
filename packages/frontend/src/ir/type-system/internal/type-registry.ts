/**
 * TypeRegistry - Pure IR source of truth for type declarations
 *
 * ALICE'S SPEC (Step 3): This registry stores IrType (pure IR), NOT ts.TypeNode.
 * Types are converted at registration time, making queries deterministic.
 *
 * CANONICAL CLR IDENTITY: Well-known runtime types from compiler core globals,
 * Tsonic surface packages, @tsonic/core, and @tsonic/dotnet are registered
 * with canonical CLR FQ names
 * (e.g., String → System.String, String$instance → System.String$instance).
 *
 * Part of Alice's specification for deterministic IR typing.
 *
 * FACADE: This module re-exports from registry-helpers.ts and registry-builder.ts.
 * Type declarations are kept here so that all consumers can import from one path.
 */

import * as ts from "typescript";
import type { IrType, IrMethodSignature } from "../../types/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// PURE IR TYPES (Alice's Spec)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Information about a type member (property or method) - PURE IR
 */
export type MemberInfo = {
  readonly kind: "property" | "method" | "indexSignature";
  readonly name: string;
  readonly type: IrType | undefined; // PURE IR - converted at registration time
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly methodSignatures?: readonly IrMethodSignature[]; // For methods - PURE IR
};

/**
 * Heritage clause information (extends/implements) - PURE IR
 */
export type HeritageInfo = {
  readonly kind: "extends" | "implements";
  readonly baseType: IrType; // PURE IR - converted at registration time
  readonly typeName: string; // The resolved type name
};

/**
 * Type parameter info for generic types - PURE IR
 */
export type TypeParameterEntry = {
  readonly name: string;
  readonly constraint?: IrType; // PURE IR
  readonly defaultType?: IrType; // PURE IR
};

/**
 * Entry for a nominal type (class, interface, type alias) - PURE IR
 *
 * NOTE: No ts.Declaration, ts.SourceFile, or ts.TypeNode fields.
 */
export type TypeRegistryEntry = {
  readonly kind: "class" | "interface" | "typeAlias";
  readonly name: string; // Simple name (e.g., "User")
  readonly fullyQualifiedName: string; // FQ name (e.g., "MyApp.Models.User")
  readonly ownerIdentity: string;
  readonly isDeclarationFile: boolean;
  readonly typeParameters: readonly TypeParameterEntry[]; // PURE IR
  readonly members: ReadonlyMap<string, MemberInfo>; // PURE IR
  readonly heritage: readonly HeritageInfo[]; // PURE IR
  readonly aliasedType?: IrType; // For type aliases - the aliased type (PURE IR)
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPEREISTRY API (Pure IR)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TypeRegistry API - returns pure IR types
 */
export type TypeRegistry = {
  /**
   * Resolve a type by fully-qualified name. Returns undefined if not found.
   */
  readonly resolveNominal: (fqName: string) => TypeRegistryEntry | undefined;

  /**
   * Resolve a type by simple name.
   * Returns first match if multiple types have the same simple name.
   */
  readonly resolveBySimpleName: (
    simpleName: string
  ) => TypeRegistryEntry | undefined;

  /**
   * Get the fully-qualified name for a simple name.
   * Returns undefined if not found.
   */
  readonly getFQName: (simpleName: string) => string | undefined;

  /**
   * Get a member's type from a nominal type (by FQ name).
   * Returns pure IrType - no TypeNode access needed.
   */
  readonly getMemberType: (
    fqNominal: string,
    memberName: string
  ) => IrType | undefined;

  /**
   * Get all heritage clauses for a nominal type (by FQ name).
   * Returns pure IrType heritage info.
   */
  readonly getHeritageTypes: (fqNominal: string) => readonly HeritageInfo[];

  /**
   * Get all registered type names (fully-qualified).
   */
  readonly getAllTypeNames: () => readonly string[];

  /**
   * Check if a type name is registered (by FQ name).
   */
  readonly hasType: (fqName: string) => boolean;
};

/**
 * Type conversion function - converts TypeNode to IrType
 */
export type ConvertTypeFn = (typeNode: ts.TypeNode) => IrType;

export type BuildTypeRegistryOptions = {
  readonly convertType?: ConvertTypeFn;
};

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { buildTypeRegistry } from "./registry-builder.js";

/**
 * Type Universe — Raw External Binding JSON Types & Factory Functions
 *
 * Raw JSON type shapes matching tsbindgen <Namespace>/bindings.json,
 * factory functions for TypeId creation.
 */

import type {
  IrAsyncWrapperMetadata,
  IrIterableShapeMetadata,
  IrParameter,
  IrType,
} from "../../../types/index.js";
import type { SourcePrimitiveName, TypeId } from "./catalog-types.js";
import { typeSymbolIdFromStableId } from "../../../../symbols/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// RAW JSON TYPES — Shapes matching external <Namespace>/bindings.json
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw type entry from bindings.json.
 *
 * This is a superset of the historical metadata.json + bindings.json data:
 * - Type shape/kind/accessibility for the external type catalog
 * - Member signature metadata for semantic typing
 * - Binding target metadata (owner/type/member) for codegen
 *
 * IMPORTANT: No `tsEmitName` fields exist. TS names are derived deterministically
 * from provider target names (generics + nested types) and member target names.
 */
export type RawBindingsType = {
  readonly stableId: string;
  readonly targetName: string;
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
  readonly ownerIdentity?: string;
  readonly sourcePrimitive?: SourcePrimitiveName;
  readonly asyncWrapper?: IrAsyncWrapperMetadata;
  readonly iterableShape?: IrIterableShapeMetadata;
  readonly metadataToken?: number;
};

export type RawBindingsHeritageType = {
  readonly stableId: string;
  readonly targetName: string;
  readonly typeArguments?: readonly string[];
};

export type RawBindingsMethod = {
  readonly stableId: string;
  readonly targetName: string;
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
  readonly ownerQualifiedName?: string;
  readonly ownerIdentity?: string;
  readonly parameterModifiers?: readonly {
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }[];
  readonly metadataToken?: number;
};

export type RawBindingsProperty = {
  readonly stableId: string;
  readonly targetName: string;
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
  readonly ownerQualifiedName?: string;
  readonly ownerIdentity?: string;
  readonly metadataToken?: number;
};

export type RawBindingsField = {
  readonly stableId: string;
  readonly targetName: string;
  readonly normalizedSignature: string;
  readonly semanticType?: IrType;
  readonly semanticOptional?: boolean;
  readonly isStatic: boolean;
  readonly isReadOnly: boolean;
  readonly isLiteral: boolean;
  readonly ownerQualifiedName?: string;
  readonly ownerIdentity?: string;
  readonly metadataToken?: number;
};

export type RawBindingsConstructor = {
  readonly normalizedSignature: string;
  readonly isStatic: boolean;
  readonly parameterCount: number;
};

export type RawTsbindgenBindingsFile = {
  readonly schema: "tsonic.bindings";
  readonly provider: {
    readonly namespace: string;
    readonly ownerIdentities?: readonly string[];
    readonly targetRuntimeVersion?: string;
  };
  readonly targetSurface: {
    readonly types: readonly RawBindingsType[];
    readonly exports?: Readonly<Record<string, unknown>>;
  };
};

export type RawBindingsFile = RawTsbindgenBindingsFile;

export type RawBindingsPayload = {
  readonly namespace: string;
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
  providerName: string,
  ownerIdentity: string,
  sourceName: string,
  origin: "source" | "external" = "external"
): TypeId => ({
  stableId,
  providerName,
  symbolId: typeSymbolIdFromStableId(stableId),
  sourceName,
  ownerIdentity,
  origin,
});

/**
 * Provider lookup accessor for external type surfaces.
 *
 * Keep direct reads of TypeId provider-local names inside this universe module.
 */
export const typeIdProviderLookupName = (typeId: TypeId): string =>
  typeId.providerName;

/**
 * Parse a stableId into ownerIdentity and targetName.
 */
export const parseStableId = (
  stableId: string
): { ownerIdentity: string; targetName: string } | undefined => {
  const colonIndex = stableId.indexOf(":");
  if (colonIndex === -1) return undefined;
  return {
    ownerIdentity: stableId.slice(0, colonIndex),
    targetName: stableId.slice(colonIndex + 1),
  };
};

/**
 * Resolve the canonical stableId for a raw external type entry.
 *
 * tsbindgen payloads should provide `stableId` directly. Some synthetic test
 * fixtures still only provide the canonical components (`ownerIdentity`,
 * `targetName`). When both components are present, the canonical stableId is
 * deterministic and identical to what tsbindgen would have emitted.
 */
export const resolveRawTypeStableId = (
  rawType: Pick<RawBindingsType, "stableId" | "ownerIdentity" | "targetName">
): string | undefined => {
  if (typeof rawType.stableId === "string" && rawType.stableId.length > 0) {
    return rawType.stableId;
  }

  if (
    typeof rawType.ownerIdentity === "string" &&
    rawType.ownerIdentity.length > 0 &&
    typeof rawType.targetName === "string" &&
    rawType.targetName.length > 0
  ) {
    return `${rawType.ownerIdentity}:${rawType.targetName}`;
  }

  return undefined;
};

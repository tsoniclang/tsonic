/**
 * Canonical symbol type registration — the single authority for deciding
 * what goes into localSemanticTypes vs localValueTypes.
 *
 * Construct emitters (functions, variables, loops, patterns, catch) call
 * these helpers instead of computing semantic/storage splits ad hoc.
 * Each function encapsulates the derivation strategy for its construct kind
 * and delegates to registerLocalSymbolTypes for the actual map update.
 *
 * ## Materialization boundary
 *
 * The emitter maintains two type channels:
 *
 * - **Semantic types** (localSemanticTypes): Authored frontend IR types
 *   preserving alias identity, union structure, and type-parameter shapes.
 *   These flow into analysis functions (narrowing, guard analysis, layout
 *   building, `buildRuntimeUnionLayout`, `tryBuildRuntimeMaterializationAst`).
 *
 * - **Storage types** (localValueTypes): CLR-normalized carriers produced
 *   by `normalizeRuntimeStorageType`. These are used for C# declarations
 *   and runtime dispatch.
 *
 * The lowering boundary is enforced at emission points:
 *
 * - `emitTypeAst()` is where semantic → C# AST conversion happens.
 * - `normalizeRuntimeStorageType` is called only at symbol registration
 *   time (here) or at final emission boundaries (e.g., `access.ts`).
 * - Analysis functions must receive semantic types, never pre-lowered
 *   storage types. Parameter modifier wrappers (ref/out/In) may be
 *   stripped for emission-time comparisons but must not be stripped
 *   before passing types to materialization functions.
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";
import {
  registerLocalSymbolTypes,
} from "../format/local-names.js";
import { deriveForOfElementType } from "./iteration-types.js";
import {
  resolveSemanticVariableInitializerType,
  resolveLocalStorageType,
  type VariableDeclaratorLike,
} from "./variable-type-resolution.js";
import { getAcceptedParameterType } from "./defaults.js";

/**
 * Register a local symbol from its semantic (frontend IR) type.
 *
 * Storage type is derived automatically via normalizeRuntimeStorageType.
 * Falls back to the semantic type itself when normalization returns undefined.
 *
 * Use for: parameters, pattern bindings — where the authored type is the
 * single source of truth and storage is purely derived.
 */
export const registerParameterTypes = (
  originalName: string,
  semanticType: IrType | undefined,
  acceptsExplicitUndefined: boolean,
  context: EmitterContext
): EmitterContext => {
  const acceptedType = getAcceptedParameterType(
    semanticType,
    acceptsExplicitUndefined
  );
  const storageType =
    normalizeRuntimeStorageType(acceptedType, context) ??
    acceptedType ??
    semanticType;

  return registerLocalSymbolTypes(
    originalName,
    acceptedType ?? semanticType,
    storageType,
    context
  );
};

/**
 * Register for-of element semantic and storage types for a loop variable.
 *
 * Semantic: element type derived from the collection's frontend IR type.
 * Storage: element type derived from the collection's CLR-normalized type,
 * falling back to semantic when normalization produces no change.
 *
 * The two-step derivation (normalize collection → extract element) is
 * intentionally different from normalizing the element type directly,
 * because collection-level normalization can change the element extraction.
 */
export const registerForOfElementSymbolTypes = (
  originalName: string,
  collectionType: IrExpression["inferredType"],
  context: EmitterContext
): EmitterContext => {
  const semanticElementType = deriveForOfElementType(collectionType, context);
  const storageElementType = deriveForOfElementType(
    normalizeRuntimeStorageType(collectionType, context),
    context
  );
  return registerLocalSymbolTypes(
    originalName,
    semanticElementType,
    storageElementType ?? semanticElementType,
    context
  );
};

/**
 * Register both semantic and storage types for a variable declaration.
 *
 * Semantic: decl.type (explicit annotation) or the un-normalized
 * initializer type (preserving alias identity and union structure).
 * Storage: the CLR-normalized carrier via resolveLocalStorageType.
 */
export const registerVariableSymbolTypes = (
  originalName: string,
  decl: VariableDeclaratorLike,
  context: EmitterContext
): EmitterContext =>
  registerLocalSymbolTypes(
    originalName,
    decl.type ??
      resolveSemanticVariableInitializerType(decl.initializer, context),
    resolveLocalStorageType(decl, context),
    context
  );

/**
 * Register catch variable types.
 *
 * Semantic: JsValue (broad JS-visible thrown value channel).
 * Storage: System.Exception (the CLR catch carrier).
 */
export const registerCatchVariableTypes = (
  originalName: string,
  context: EmitterContext
): EmitterContext =>
  registerLocalSymbolTypes(
    originalName,
    {
      kind: "referenceType",
      name: "JsValue",
      resolvedClrType: "Tsonic.Runtime.JsValue",
    },
    {
      kind: "referenceType",
      name: "System.Exception",
      resolvedClrType: "global::System.Exception",
    },
    context
  );

/**
 * Register for-in key variable types.
 *
 * Both semantic and storage are string — for-in keys are always strings
 * in both channels.
 */
export const registerForInKeyTypes = (
  originalName: string,
  context: EmitterContext
): EmitterContext =>
  registerLocalSymbolTypes(
    originalName,
    { kind: "primitiveType", name: "string" },
    { kind: "primitiveType", name: "string" },
    context
  );
